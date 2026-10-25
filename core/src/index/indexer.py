"""SQLite indexer with FTS5 and full-rebuild support from open files."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from memory.models import (
    ConflictRecord,
    DocumentType,
    MemoryDocument,
    ModelRequestRecord,
    SourceRecord,
    TaskStatus,
)
from memory.parser import parse_markdown_with_frontmatter


RUSSIAN_STOP_WORDS = {
    "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она",
    "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее",
    "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "об", "из", "ему", "теперь", "когда",
    "даже", "ну", "вдруг", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до",
    "вас", "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей",
    "может", "они", "тут", "где", "есть", "надо", "ней", "для", "мы", "тебя", "их", "чем",
    "была", "сам", "чтоб", "без", "будто", "чего", "раз", "тоже", "себе", "под", "будет",
    "тогда", "кто", "этот", "того", "потому", "этого", "какой", "совсем", "ним", "здесь",
    "этом", "один", "почти", "мой", "тем", "чтобы", "нее", "сейчас", "были", "куда", "зачем",
    "всех", "никогда", "можно", "при", "наконец", "два", "свои", "эту", "мои", "всего",
    "какая", "исключая", "эти", "наш", "про", "нами",
    "the", "and", "or", "is", "in", "at", "of", "a", "an", "to", "for", "on", "with",
}


class Indexer:
    def __init__(self, db_path: Union[str, Path]):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.executescript("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                relative_path TEXT UNIQUE NOT NULL,
                doc_type TEXT NOT NULL,
                title TEXT,
                body_hash TEXT NOT NULL,
                revision INTEGER DEFAULT 1,
                size INTEGER DEFAULT 0,
                mtime REAL DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                source_id TEXT
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                id UNINDEXED,
                title,
                body,
                doc_type UNINDEXED,
                date_str UNINDEXED,
                tokenize = 'unicode61'
            );

            CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY,
                source_type TEXT NOT NULL,
                app_name TEXT NOT NULL,
                window_title TEXT,
                uri TEXT,
                captured_at TEXT,
                method TEXT,
                metadata_json TEXT
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                due_date TEXT,
                confirmed INTEGER DEFAULT 1,
                source_id TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS conflicts (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                canonical_path TEXT NOT NULL,
                conflict_path TEXT NOT NULL,
                metadata_path TEXT NOT NULL,
                reason TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS model_requests (
                id TEXT PRIMARY KEY,
                timestamp TEXT,
                mode TEXT,
                endpoint TEXT,
                model TEXT,
                status TEXT,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                response_summary TEXT
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            """)

    def index_document(self, doc: MemoryDocument, file_path: Path, root_dir: Path) -> None:
        """Insert or update a document in SQLite and FTS5."""
        rel_path = str(file_path.resolve().relative_to(root_dir.resolve()))
        stat = file_path.stat()
        mtime = stat.st_mtime
        size = stat.st_size
        body_hash = doc.recalculate_hash()

        with self._get_connection() as conn:
            # 1. Update documents table
            conn.execute(
                """
                INSERT INTO documents (
                    id, relative_path, doc_type, title, body_hash,
                    revision, size, mtime, created_at, updated_at, source_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    relative_path = excluded.relative_path,
                    doc_type = excluded.doc_type,
                    title = excluded.title,
                    body_hash = excluded.body_hash,
                    revision = excluded.revision,
                    size = excluded.size,
                    mtime = excluded.mtime,
                    updated_at = excluded.updated_at,
                    source_id = excluded.source_id
                """,
                (
                    doc.metadata.id,
                    rel_path,
                    doc.metadata.doc_type.value,
                    doc.metadata.title,
                    body_hash,
                    doc.metadata.revision,
                    size,
                    mtime,
                    doc.metadata.created_at,
                    doc.metadata.updated_at,
                    doc.metadata.source_id,
                ),
            )

            # 2. Update FTS table (delete prior entry, insert new)
            conn.execute("DELETE FROM documents_fts WHERE id = ?", (doc.metadata.id,))
            date_str = doc.metadata.created_at[:10] if doc.metadata.created_at else ""
            conn.execute(
                """
                INSERT INTO documents_fts (id, title, body, doc_type, date_str)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    doc.metadata.id,
                    doc.metadata.title or "",
                    doc.body or "",
                    doc.metadata.doc_type.value,
                    date_str,
                ),
            )

            # 3. If task, also sync tasks table
            if doc.metadata.doc_type == DocumentType.TASK:
                status = doc.metadata.extra.get("status", TaskStatus.TODO.value)
                due_date = doc.metadata.extra.get("due_date")
                confirmed = 1 if doc.metadata.extra.get("confirmed", True) else 0
                conn.execute(
                    """
                    INSERT INTO tasks (
                        id, title, status, due_date, confirmed, source_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        title = excluded.title,
                        status = excluded.status,
                        due_date = excluded.due_date,
                        confirmed = excluded.confirmed,
                        source_id = excluded.source_id,
                        updated_at = excluded.updated_at
                    """,
                    (
                        doc.metadata.id,
                        doc.metadata.title,
                        status,
                        due_date,
                        confirmed,
                        doc.metadata.source_id,
                        doc.metadata.created_at,
                        doc.metadata.updated_at,
                    ),
                )

    def remove_document(self, doc_id: str) -> None:
        """Remove document from index on file deletion."""
        with self._get_connection() as conn:
            conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            conn.execute("DELETE FROM documents_fts WHERE id = ?", (doc_id,))
            conn.execute("DELETE FROM tasks WHERE id = ?", (doc_id,))

    def record_conflict(self, conflict: ConflictRecord) -> None:
        """Record conflict in database."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO conflicts (
                    id, doc_id, canonical_path, conflict_path, metadata_path, reason, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                (
                    conflict.id,
                    conflict.doc_id,
                    conflict.canonical_path,
                    conflict.conflict_path,
                    conflict.metadata_path,
                    conflict.reason,
                    conflict.timestamp,
                ),
            )

    def search(
        self,
        query: str,
        doc_type: Optional[str] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Perform full-text search with ranking (FTS5 BM25)."""
        import re
        clean_query = query.strip()
        if not clean_query:
            return []

        # Split into tokens, sanitize and build prefix/term query
        raw_words = [re.sub(r'[^\w\d_]', '', w) for w in clean_query.split()]
        raw_words = [w for w in raw_words if w]
        if not raw_words:
            return []

        # Filter out grammatical stop words for natural questions
        content_words = [w for w in raw_words if w.lower() not in RUSSIAN_STOP_WORDS]
        if not content_words:
            content_words = raw_words

        # Format terms with prefix wildcard and language cross-term expansion
        expanded_tokens: List[str] = []
        for w in content_words:
            low = w.lower()
            expanded_tokens.append(f'"{w}"*' if len(w) >= 3 else f'"{w}"')
            if "window" in low and "винд*" not in expanded_tokens:
                expanded_tokens.append('"винд"*')
            elif "винд" in low and "window*" not in expanded_tokens:
                expanded_tokens.append('"window"*')

        formatted_query = " OR ".join(expanded_tokens)

        sql = """
        SELECT
            d.id,
            d.relative_path,
            d.doc_type,
            d.title,
            d.created_at,
            d.updated_at,
            d.source_id,
            snippet(documents_fts, 2, '<b>', '</b>', '...', 15) as snippet,
            bm25(documents_fts) as rank
        FROM documents_fts
        JOIN documents d ON d.id = documents_fts.id
        WHERE documents_fts MATCH ?
        """
        params: List[Any] = [formatted_query]

        if doc_type:
            sql += " AND d.doc_type = ?"
            params.append(doc_type)

        sql += " ORDER BY rank LIMIT ?"
        params.append(limit)

        results = []
        with self._get_connection() as conn:
            try:
                cursor = conn.execute(sql, params)
                for row in cursor.fetchall():
                    results.append(dict(row))
            except sqlite3.OperationalError:
                # Fallback to standard LIKE if FTS syntax issue
                fallback_sql = """
                SELECT id, relative_path, doc_type, title, created_at, updated_at, source_id,
                       title as snippet, 0 as rank
                FROM documents
                WHERE title LIKE ? OR id LIKE ?
                LIMIT ?
                """
                like_term = f"%{clean_query}%"
                cursor = conn.execute(fallback_sql, (like_term, like_term, limit))
                for row in cursor.fetchall():
                    results.append(dict(row))

        return results

    def rebuild_from_storage(self, root_dir: Path) -> int:
        """Complete rebuild of index by scanning all Markdown & JSON files in Memory.
        F16 requirement: Восстановление индекса из файлов.
        """
        count = 0
        root_dir = root_dir.resolve()
        # Scan days/ and tasks/
        for md_path in root_dir.rglob("*.md"):
            # Skip .system and conflicts
            rel = md_path.relative_to(root_dir)
            if ".system" in rel.parts or "conflicts" in rel.parts or rel.name == "README.md":
                continue

            try:
                content = md_path.read_text(encoding="utf-8")
                doc = parse_markdown_with_frontmatter(content, default_id=md_path.stem)
                self.index_document(doc, md_path, root_dir)
                count += 1
            except Exception:
                continue

        return count

    def get_setting(self, key: str, default: Optional[str] = None) -> Optional[str]:
        with self._get_connection() as conn:
            cur = conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
            row = cur.fetchone()
            return row["value"] if row else default

    def set_setting(self, key: str, value: str) -> None:
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, value),
            )

    def list_tasks(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM tasks"
        params = []
        if status:
            sql += " WHERE status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC"
        with self._get_connection() as conn:
            cur = conn.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

    def list_conflicts(self) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cur = conn.execute("SELECT * FROM conflicts ORDER BY created_at DESC")
            return [dict(r) for r in cur.fetchall()]
