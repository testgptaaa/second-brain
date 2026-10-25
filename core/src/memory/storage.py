"""MemoryStorage engine implementing date-partitioned storage and conflict preservation."""

from __future__ import annotations

import json
import hashlib
import uuid
import os
import shutil
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from .models import (
    ConflictRecord,
    DocMetadata,
    DocumentType,
    MemoryDocument,
    ModelRequestRecord,
    SourceRecord,
    TaskStatus,
    compute_body_hash,
)
from .parser import parse_markdown_with_frontmatter, serialize_markdown_document

README_TEXT = """# Хранилище памяти «Второй мозг»

Все данные в этой папке сохранены в виде открытых файлов Markdown и JSON.
Вы можете открывать, просматривать и редактировать эти файлы в любых текстовых редакторах (Obsidian, VS Code, Notepad и др.).

## Структура
- `days/YYYY/MM/DD/`: Заметки, контекст работы и эпизоды по датам.
- `tasks/`: Текущие задачи и договорённости.
- `.system/`: Служебные версии и производный поисковый индекс (SQLite).

Приложение автоматически подхватывает внешние изменения. Если файл был изменён одновременно вами и приложением, ваши изменения всегда остаются на месте, а версия приложения сохраняется рядом в папке `conflicts/`.
"""


class MemoryStorage:
    def __init__(self, root_dir: Union[str, Path]):
        self.root_dir = Path(root_dir).resolve()
        self.days_dir = self.root_dir / "days"
        self.tasks_dir = self.root_dir / "tasks"
        self.system_dir = self.root_dir / ".system"
        self.versions_dir = self.system_dir / "versions"
        self.sqlite_path = self.system_dir / "runtime.sqlite"
        self.deletions_log_path = self.system_dir / "deletions.jsonl"

        # Journal of writes initiated by the app: {abs_path: (timestamp, body_hash)}
        self.app_write_journal: Dict[str, Tuple[float, str]] = {}

    def init_storage(self) -> None:
        """Initialize directory tree and starter files."""
        self.root_dir.mkdir(parents=True, exist_ok=True)
        self.days_dir.mkdir(parents=True, exist_ok=True)
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        (self.tasks_dir / "conflicts").mkdir(parents=True, exist_ok=True)
        self.system_dir.mkdir(parents=True, exist_ok=True)
        self.versions_dir.mkdir(parents=True, exist_ok=True)

        readme_file = self.root_dir / "README.md"
        if not readme_file.exists():
            readme_file.write_text(README_TEXT, encoding="utf-8")

    def get_day_dir(self, dt: Optional[Union[date, datetime]] = None) -> Path:
        """Get or create path for days/YYYY/MM/DD with all necessary subfolders."""
        if dt is None:
            dt = datetime.now()
        day_path = (
            self.days_dir / f"{dt.year:04d}" / f"{dt.month:02d}" / f"{dt.day:02d}"
        )
        for sub in (
            "episodes",
            "context",
            "notes",
            "sources",
            "requests",
            "attachments",
            "conflicts",
        ):
            (day_path / sub).mkdir(parents=True, exist_ok=True)
        return day_path

    def _archive_previous_version(
        self, doc_id: str, revision: int, content: str
    ) -> Path:
        """Save previous version in .system/versions/<id>/<revision>-<timestamp>.md"""
        if not doc_id or any(
            c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
            for c in doc_id
        ):
            raise ValueError("Invalid document ID")
        target_dir = self.versions_dir / doc_id
        target_dir.mkdir(parents=True, exist_ok=True)
        ts_str = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        version_filename = f"{revision:04d}-{ts_str}.md"
        version_file = target_dir / version_filename
        version_file.write_text(content, encoding="utf-8")
        return version_file

    def write_document(
        self,
        doc: MemoryDocument,
        target_path: Path,
        expected_base_hash: Optional[str] = None,
        base_revision: int = 1,
        expected_file_hash: Optional[str] = None,
    ) -> Tuple[bool, Optional[ConflictRecord]]:
        """Atomically writes document with conflict detection.
        Returns:
            (success, conflict_record)
        If conflict occurs, the human file is kept untouched, and the app version is written
        to conflicts/ as specified in EXTERNAL_EDITS.md.
        """
        target_path = target_path.resolve()
        if not target_path.is_relative_to(self.root_dir.resolve()):
            raise ValueError("Path outside memory root")
        target_dir = target_path.parent
        target_dir.mkdir(parents=True, exist_ok=True)

        # 1. Conflict check if file already exists
        if target_path.exists():
            current_raw = target_path.read_text(encoding="utf-8")
            current_doc = parse_markdown_with_frontmatter(current_raw)
            current_disk_hash = current_doc.body_hash

            if (
                expected_base_hash is not None
                and current_disk_hash != expected_base_hash
            ) or (
                expected_file_hash is not None
                and hashlib.sha256(current_raw.encode()).hexdigest()
                != expected_file_hash
            ):
                # CONFLICT DETECTED!
                now_str = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
                conflicts_dir = target_dir / "conflicts"
                conflicts_dir.mkdir(parents=True, exist_ok=True)

                conflict_md_name = (
                    f"{target_path.stem}.app-{now_str}{target_path.suffix}"
                )
                conflict_json_name = f"{target_path.stem}.app-{now_str}.json"
                conflict_md_path = conflicts_dir / conflict_md_name
                conflict_json_path = conflicts_dir / conflict_json_name

                # Write app's diverging version
                serialized_app = serialize_markdown_document(doc)
                conflict_md_path.write_text(serialized_app, encoding="utf-8")

                conflict_record = ConflictRecord(
                    id=f"cnf-{doc.metadata.id}-{int(time.time())}",
                    doc_id=doc.metadata.id,
                    canonical_path=str(target_path.relative_to(self.root_dir)),
                    conflict_path=str(conflict_md_path.relative_to(self.root_dir)),
                    metadata_path=str(conflict_json_path.relative_to(self.root_dir)),
                    reason="Target file modified externally since last read",
                    base_revision=base_revision,
                    base_hash=expected_base_hash,
                    human_hash=current_disk_hash or "",
                    app_hash=doc.recalculate_hash(),
                )

                conflict_json_path.write_text(
                    conflict_record.model_dump_json(indent=2),
                    encoding="utf-8",
                )
                return False, conflict_record

            # Archive existing version before overwrite
            self._archive_previous_version(
                doc.metadata.id, doc.metadata.revision, current_raw
            )
            doc.metadata.revision += 1

        # 2. Write to temp file and atomically replace
        serialized = serialize_markdown_document(doc)
        body_hash = doc.recalculate_hash()
        tmp_path = target_dir / f".{target_path.name}.tmp.{int(time.time() * 1000)}"
        tmp_path.write_text(serialized, encoding="utf-8")

        # Atomic replace
        os.replace(tmp_path, target_path)

        # Journal this write so watcher doesn't treat it as external edit
        abs_key = str(target_path.resolve())
        self.app_write_journal[abs_key] = (time.time(), body_hash)

        return True, None

    def read_document(self, path: Union[str, Path]) -> Optional[MemoryDocument]:
        """Read and parse document from disk."""
        target_path = Path(path)
        if not target_path.is_absolute():
            target_path = self.root_dir / target_path
        target_path = target_path.resolve()
        if not target_path.is_relative_to(self.root_dir):
            raise ValueError("Path outside memory root")
        if not target_path.exists():
            return None

        content = target_path.read_text(encoding="utf-8")
        doc = parse_markdown_with_frontmatter(content, default_id=target_path.stem)
        try:
            doc.relative_path = str(target_path.relative_to(self.root_dir))
        except ValueError:
            doc.relative_path = str(target_path)
        return doc

    def save_note(
        self,
        title: str,
        content: str,
        doc_id: Optional[str] = None,
        dt: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        source_id: Optional[str] = None,
    ) -> Tuple[MemoryDocument, Optional[ConflictRecord]]:
        """Create or update a note in days/YYYY/MM/DD/notes/."""
        if dt is None:
            dt = datetime.now()
        day_dir = self.get_day_dir(dt)
        notes_dir = day_dir / "notes"

        if not doc_id:
            doc_id = f"note-{uuid.uuid4().hex}"
            time_prefix = dt.strftime("%H-%M-%S")
            filename = f"{time_prefix}_{doc_id}.md"
            target_path = notes_dir / filename
            base_hash = None
            revision = 1
        else:
            # Look for existing note
            if not doc_id or any(
                c
                not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
                for c in doc_id
            ):
                raise ValueError("Invalid note ID")
            matches = list(self.days_dir.glob(f"*/*/*/notes/*_{doc_id}.md"))
            if matches:
                target_path = matches[0]
                existing = self.read_document(target_path)
                base_hash = existing.body_hash if existing else None
                revision = existing.metadata.revision if existing else 1
            else:
                time_prefix = dt.strftime("%H-%M-%S")
                filename = f"{time_prefix}_{doc_id}.md"
                target_path = notes_dir / filename
                base_hash = None
                revision = 1

        metadata = DocMetadata(
            id=doc_id,
            title=title,
            doc_type=DocumentType.NOTE,
            created_at=(
                existing.metadata.created_at
                if doc_id and "existing" in locals() and existing
                else dt.isoformat()
            ),
            updated_at=datetime.now().isoformat(),
            revision=revision,
            tags=tags or [],
            source_id=source_id,
        )
        doc = MemoryDocument(metadata=metadata, body=content)
        success, conflict = self.write_document(
            doc,
            target_path,
            expected_base_hash=base_hash,
            base_revision=revision,
        )
        try:
            doc.relative_path = str(target_path.relative_to(self.root_dir))
        except ValueError:
            doc.relative_path = str(target_path)
        return doc, conflict

    def save_task(
        self,
        title: str,
        description: str = "",
        task_id: Optional[str] = None,
        status: TaskStatus = TaskStatus.TODO,
        due_date: Optional[str] = None,
        confirmed: bool = True,
        source_id: Optional[str] = None,
    ) -> Tuple[MemoryDocument, Optional[ConflictRecord]]:
        """Create or update a task in tasks/."""
        if not task_id:
            task_id = f"task-{uuid.uuid4().hex}"
            target_path = self.tasks_dir / f"{task_id}.md"
            base_hash = None
            revision = 1
        else:
            target_path = self.tasks_dir / f"{task_id}.md"
            if target_path.exists():
                existing = self.read_document(target_path)
                base_hash = existing.body_hash if existing else None
                revision = existing.metadata.revision if existing else 1
            else:
                base_hash = None
                revision = 1

        metadata = DocMetadata(
            id=task_id,
            title=title,
            doc_type=DocumentType.TASK,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            revision=revision,
            tags=["task", status.value],
            source_id=source_id,
            extra={
                "status": status.value,
                "due_date": due_date,
                "confirmed": confirmed,
            },
        )
        doc = MemoryDocument(metadata=metadata, body=description)
        success, conflict = self.write_document(
            doc,
            target_path,
            expected_base_hash=base_hash,
            base_revision=revision,
        )
        try:
            doc.relative_path = str(target_path.relative_to(self.root_dir))
        except ValueError:
            doc.relative_path = str(target_path)
        return doc, conflict

    def save_episode(
        self,
        summary: str,
        observations: str,
        hypotheses: str = "",
        dt: Optional[datetime] = None,
        episode_id: Optional[str] = None,
        source_ids: Optional[List[str]] = None,
    ) -> MemoryDocument:
        """Save work episode in days/YYYY/MM/DD/episodes/."""
        if dt is None:
            dt = datetime.now()
        day_dir = self.get_day_dir(dt)
        episodes_dir = day_dir / "episodes"

        if not episode_id:
            episode_id = f"ep-{int(time.time() * 1000)}"
        time_prefix = dt.strftime("%H-%M-%S")
        target_path = episodes_dir / f"{time_prefix}_{episode_id}.md"

        body = (
            f"## Что делали\n\n{summary}\n\n"
            f"## Наблюдения\n\n{observations}\n\n"
            f"## Гипотезы и предложения\n\n{hypotheses or 'Отсутствуют'}\n"
        )

        metadata = DocMetadata(
            id=episode_id,
            title=summary[:80],
            doc_type=DocumentType.EPISODE,
            created_at=dt.isoformat(),
            updated_at=dt.isoformat(),
            revision=1,
            extra={"source_ids": source_ids or []},
        )
        doc = MemoryDocument(metadata=metadata, body=body)
        self.write_document(doc, target_path)
        doc.relative_path = str(target_path.relative_to(self.root_dir))
        return doc

    def save_source_record(
        self, source: SourceRecord, dt: Optional[datetime] = None
    ) -> Path:
        """Save source metadata in days/YYYY/MM/DD/sources/obs-<id>.json"""
        if dt is None:
            dt = datetime.now()
        day_dir = self.get_day_dir(dt)
        sources_dir = day_dir / "sources"
        file_path = sources_dir / f"{source.id}.json"
        file_path.write_text(source.model_dump_json(indent=2), encoding="utf-8")
        return file_path

    def save_model_request_record(
        self, req: ModelRequestRecord, dt: Optional[datetime] = None
    ) -> Path:
        """Save model request audit log in days/YYYY/MM/DD/requests/req-<id>.json.
        F06 requirement: SENSITIVE SECRETS/TOKENS ARE NEVER RECORDED HERE.
        """
        if dt is None:
            dt = datetime.now()
        day_dir = self.get_day_dir(dt)
        requests_dir = day_dir / "requests"
        file_path = requests_dir / f"{req.id}.json"
        file_path.write_text(req.model_dump_json(indent=2), encoding="utf-8")
        return file_path

    def update_day_index(self, dt: Optional[datetime] = None) -> Path:
        """Update or create days/YYYY/MM/DD/index.md summarizing the day's activity."""
        if dt is None:
            dt = datetime.now()
        day_dir = self.get_day_dir(dt)
        index_path = day_dir / "index.md"

        # Scan episodes, notes, and sources for that day
        episodes = list((day_dir / "episodes").glob("*.md"))
        notes = list((day_dir / "notes").glob("*.md"))
        sources = list((day_dir / "sources").glob("*.json"))

        date_str = dt.strftime("%Y-%m-%d")
        lines = [
            f"# Сводка за {date_str}\n",
            f"- Эпизодов за день: {len(episodes)}",
            f"- Сохранённых заметок: {len(notes)}",
            f"- Зафиксированных источников: {len(sources)}\n",
            "## Эпизоды дня",
        ]
        if not episodes:
            lines.append("*(Пока нет зафиксированных эпизодов)*")
        else:
            for ep_file in sorted(episodes):
                doc = self.read_document(ep_file)
                if doc:
                    rel = ep_file.relative_to(day_dir)
                    lines.append(f"- [{doc.metadata.title or ep_file.stem}]({rel})")

        lines.append("\n## Заметки дня")
        if not notes:
            lines.append("*(Заметок нет)*")
        else:
            for note_file in sorted(notes):
                doc = self.read_document(note_file)
                if doc:
                    rel = note_file.relative_to(day_dir)
                    lines.append(f"- [{doc.metadata.title or note_file.stem}]({rel})")

        index_doc = MemoryDocument(
            metadata=DocMetadata(
                id=f"day-index-{date_str}",
                title=f"Сводка за {date_str}",
                doc_type=DocumentType.DAY_INDEX,
                created_at=dt.isoformat(),
                updated_at=datetime.now().isoformat(),
            ),
            body="\n".join(lines),
        )
        self.write_document(index_doc, index_path)
        return index_path
