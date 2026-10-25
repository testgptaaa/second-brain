"""JSON IPC protocol handler for Electron <-> Python communication over stdin/stdout."""

from __future__ import annotations

from diagnostics import record
from protocol import emit
import json
import hashlib
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from adapters.window_tracker import WindowTracker
from adapters.screen_capturer import ScreenCapturer
from adapters.cleaner import clean_temporary_screenshots
from gateway.client import ModelGateway
from index.indexer import Indexer
from memory.models import (
    CaptureMethod,
    DocMetadata,
    DocumentType,
    MemoryDocument,
    SourceRecord,
    SourceType,
    TaskStatus,
)
from memory.storage import MemoryStorage
from policy.policy import PolicyEngine
from suggestions.engine import SuggestionEngine
from watcher.observer import MemoryWatcher

PROTOCOL_VERSION = "1.0"


class IPCHandler:
    def __init__(self, memory_root: str):
        self.storage = MemoryStorage(memory_root)
        self.storage.init_storage()

        self.indexer = Indexer(self.storage.sqlite_path)
        self.policy = PolicyEngine(self.indexer)
        self.gateway = ModelGateway(self.storage, self.indexer)
        self.suggestions = SuggestionEngine(self.storage, self.indexer)
        self.window_tracker = WindowTracker()
        self.screen_capturer = ScreenCapturer()

        # Capture interval in seconds (default 15s as requested by user)
        stored_interval = self.indexer.get_setting("capture_interval_seconds")
        default_interval = int(os.environ.get("CAPTURE_INTERVAL_SECONDS", "15"))
        self.capture_interval_seconds = (
            int(stored_interval) if stored_interval else default_interval
        )

        self.last_capture_time: float = 0.0
        self.last_app: str = ""
        self.last_title: str = ""
        self.last_url: str = ""

        # Start filesystem watcher
        self.watcher = MemoryWatcher(
            storage=self.storage,
            indexer=self.indexer,
            on_change_callback=self._on_external_file_changed,
        )
        self.watcher.start()

        # Initial index rebuild if first launch
        self.indexer.rebuild_from_storage(self.storage.root_dir)

    def _on_external_file_changed(self, doc: MemoryDocument, file_path: str) -> None:
        """Push notification to Electron when an external file change is detected."""
        if doc is None:
            self.send_event("storage:file_changed", {"deleted_or_moved": True})
            return
        self.send_event(
            "storage:file_changed",
            {
                "id": doc.metadata.id,
                "title": doc.metadata.title,
                "doc_type": doc.metadata.doc_type.value,
                "path": file_path,
            },
        )

    def send_event(self, event_name: str, payload: Dict[str, Any]) -> None:
        """Send asynchronous push event to Electron."""
        msg = {
            "version": PROTOCOL_VERSION,
            "event": event_name,
            "payload": payload,
        }
        emit(msg)

    def handle_request(self, req: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming request and return response dict."""
        started = time.monotonic()
        if not isinstance(req, dict):
            raise ValueError("Invalid request")
        req_id = req.get("request_id", "")
        req_type = req.get("type", "")
        payload = req.get("payload", {})

        try:
            if not isinstance(req_type, str) or not isinstance(payload, dict):
                raise ValueError("Invalid command or payload")
            for name in ("title", "content", "description", "question", "query"):
                if name in payload and (
                    not isinstance(payload[name], str) or len(payload[name]) > 1000000
                ):
                    raise ValueError("Invalid text field")
            if "title" in payload and not payload["title"].strip():
                raise ValueError("Title is required")
            if payload.get("due_date") is not None:
                datetime.fromisoformat(payload["due_date"])
            if (
                "id" in payload
                and payload["id"] is not None
                and (
                    not isinstance(payload["id"], str)
                    or any(
                        c
                        not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
                        for c in payload["id"]
                    )
                )
            ):
                raise ValueError("Invalid ID")
            if "status" in payload:
                TaskStatus(payload["status"])
            handler_method = getattr(self, f"cmd_{req_type.replace(':', '_')}", None)
            if handler_method:
                result = handler_method(payload)
                record("request.completed", req_id, (time.monotonic() - started) * 1000)
                return {
                    "version": PROTOCOL_VERSION,
                    "request_id": req_id,
                    "type": req_type,
                    "payload": result,
                    "error": None,
                }
            else:
                return {
                    "version": PROTOCOL_VERSION,
                    "request_id": req_id,
                    "type": req_type,
                    "payload": None,
                    "error": f"Unknown command: {req_type}",
                }
        except Exception as e:
            record(
                "request.failed",
                req_id,
                (time.monotonic() - started) * 1000,
                type(e).__name__,
            )
            return {
                "version": PROTOCOL_VERSION,
                "request_id": req_id,
                "type": req_type,
                "payload": None,
                "error": str(e),
            }

    # --- Command implementations ---

    def cmd_ping(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {"pong": True, "time": time.time()}

    def cmd_storage_status(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "root_dir": str(self.storage.root_dir),
            "days_dir": str(self.storage.days_dir),
            "tasks_dir": str(self.storage.tasks_dir),
            "sqlite_path": str(self.storage.sqlite_path),
        }

    def cmd_storage_sync(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        indexed_count = self.indexer.rebuild_from_storage(self.storage.root_dir)
        return {"indexed_count": indexed_count}

    def cmd_storage_list_days(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        days = []
        if self.storage.days_dir.exists():
            for y_dir in sorted(self.storage.days_dir.glob("[0-9][0-9][0-9][0-9]")):
                for m_dir in sorted(y_dir.glob("[0-9][0-9]")):
                    for d_dir in sorted(m_dir.glob("[0-9][0-9]")):
                        date_str = f"{y_dir.name}-{m_dir.name}-{d_dir.name}"
                        ep_count = len(list((d_dir / "episodes").glob("*.md")))
                        note_count = len(list((d_dir / "notes").glob("*.md")))
                        days.append(
                            {
                                "date": date_str,
                                "path": str(d_dir.relative_to(self.storage.root_dir)),
                                "episodes_count": ep_count,
                                "notes_count": note_count,
                            }
                        )
        return {"days": sorted(days, key=lambda x: x["date"], reverse=True)}

    def cmd_storage_get_day(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        date_str = payload.get("date")
        if not date_str:
            dt = datetime.now()
        else:
            parts = date_str.split("-")
            dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))

        day_dir = (
            self.storage.days_dir
            / f"{dt.year:04d}"
            / f"{dt.month:02d}"
            / f"{dt.day:02d}"
        )
        episodes = []
        for ep_file in sorted((day_dir / "episodes").glob("*.md")):
            doc = self.storage.read_document(ep_file)
            if doc:
                episodes.append(
                    {
                        "id": doc.metadata.id,
                        "title": doc.metadata.title,
                        "body": doc.body,
                        "path": doc.relative_path,
                        "created_at": doc.metadata.created_at,
                    }
                )

        notes = []
        for n_file in sorted((day_dir / "notes").glob("*.md")):
            doc = self.storage.read_document(n_file)
            if doc:
                notes.append(
                    {
                        "id": doc.metadata.id,
                        "title": doc.metadata.title,
                        "body": doc.body,
                        "path": doc.relative_path,
                        "created_at": doc.metadata.created_at,
                        "tags": doc.metadata.tags,
                    }
                )

        return {
            "date": dt.strftime("%Y-%m-%d"),
            "episodes": episodes,
            "notes": notes,
        }

    def cmd_notes_create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        title = payload.get("title", "Без названия")
        content = payload.get("content", "")
        tags = payload.get("tags", [])
        doc_id = payload.get("id")
        source_id = payload.get("source_id")

        doc, conflict = self.storage.save_note(
            title=title,
            content=content,
            doc_id=doc_id,
            tags=tags,
            source_id=source_id,
        )
        if conflict:
            self.indexer.record_conflict(conflict)
            return {
                "success": False,
                "conflict": conflict.model_dump(),
                "doc": doc.model_dump(),
            }

        # Index document
        abs_path = self.storage.root_dir / (doc.relative_path or "")
        if abs_path.exists():
            self.indexer.index_document(doc, abs_path, self.storage.root_dir)

        return {"success": True, "doc": doc.model_dump(), "conflict": None}

    def _find_document(self, doc_id: str, kind: str):
        if (
            not isinstance(doc_id, str)
            or not doc_id
            or any(
                c
                not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
                for c in doc_id
            )
        ):
            raise ValueError("Invalid document ID")
        for path in self.storage.root_dir.rglob("*.md"):
            if any(
                part in (".system", "conflicts")
                for part in path.relative_to(self.storage.root_dir).parts
            ):
                continue
            if not path.resolve().is_relative_to(self.storage.root_dir.resolve()):
                continue
            doc = self.storage.read_document(path)
            if (
                doc
                and doc.metadata.id == doc_id
                and doc.metadata.doc_type.value == kind
            ):
                return path, doc
        raise FileNotFoundError("Document not found")

    def cmd_notes_list(self, payload):
        notes = []
        for path in self.storage.days_dir.glob("*/*/*/notes/*.md"):
            if not path.resolve().is_relative_to(self.storage.root_dir.resolve()):
                continue
            doc = self.storage.read_document(path)
            if doc:
                notes.append(
                    {
                        "id": doc.metadata.id,
                        "title": doc.metadata.title,
                        "content": doc.body,
                        "tags": doc.metadata.tags,
                        "updated_at": doc.metadata.updated_at,
                        "created_at": doc.metadata.created_at,
                        "revision": doc.metadata.revision,
                        "base_hash": doc.body_hash,
                        "file_hash": hashlib.sha256(path.read_bytes()).hexdigest(),
                    }
                )
        return {
            "notes": sorted(
                notes, key=lambda n: (n["updated_at"], n["id"]), reverse=True
            )
        }

    def cmd_notes_update(self, payload):
        path, doc = self._find_document(payload.get("id"), "note")
        if (
            payload.get("file_hash", hashlib.sha256(path.read_bytes()).hexdigest())
            != hashlib.sha256(path.read_bytes()).hexdigest()
            or payload.get("revision", doc.metadata.revision) != doc.metadata.revision
            or payload.get("base_hash", doc.body_hash) != doc.body_hash
        ):
            raise ValueError("CONFLICT: документ изменён, перечитайте его")
        base = payload.get("base_hash", doc.body_hash)
        doc.metadata.title = payload.get("title", doc.metadata.title)
        doc.metadata.tags = payload.get("tags", doc.metadata.tags)
        doc.metadata.updated_at = datetime.now().isoformat()
        doc.body = payload.get("content", doc.body)
        ok, conflict = self.storage.write_document(
            doc,
            path,
            expected_base_hash=base,
            expected_file_hash=payload.get("file_hash"),
        )
        if conflict:
            self.indexer.record_conflict(conflict)
            return {"success": False, "conflict": conflict.model_dump()}
        self.indexer.index_document(doc, path, self.storage.root_dir)
        return {"success": ok}

    def _delete_document(self, payload, kind):
        try:
            path, doc = self._find_document(payload.get("id"), kind)
        except FileNotFoundError:
            return {"success": True}
        if payload.get("revision", doc.metadata.revision) != doc.metadata.revision:
            raise ValueError("CONFLICT: документ изменён")
        self.storage._archive_previous_version(
            doc.metadata.id, doc.metadata.revision, path.read_text(encoding="utf-8")
        )
        path.unlink()
        self.indexer.remove_document(doc.metadata.id)
        return {"success": True}

    def cmd_notes_delete(self, payload):
        return self._delete_document(payload, "note")

    def cmd_tasks_delete(self, payload):
        return self._delete_document(payload, "task")

    def cmd_sources_list(self, payload):
        sources = []
        for path in self.storage.days_dir.glob("*/*/*/sources/*.json"):
            if path.resolve().is_relative_to(self.storage.root_dir.resolve()):
                data = json.loads(path.read_text(encoding="utf-8"))
                sources.append(data)
        return {"sources": sources}

    def cmd_tasks_create(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        title = payload.get("title", "")
        description = payload.get("description", "")
        due_date = payload.get("due_date")
        confirmed = payload.get("confirmed", True)
        source_id = payload.get("source_id")
        task_id = payload.get("id")

        status_val = payload.get("status", TaskStatus.TODO.value)
        try:
            status = TaskStatus(status_val)
        except ValueError:
            status = TaskStatus.TODO

        doc, conflict = self.storage.save_task(
            title=title,
            description=description,
            task_id=task_id,
            status=status,
            due_date=due_date,
            confirmed=confirmed,
            source_id=source_id,
        )
        if conflict:
            self.indexer.record_conflict(conflict)
            return {
                "success": False,
                "conflict": conflict.model_dump(),
                "doc": doc.model_dump(),
            }

        abs_path = self.storage.root_dir / (doc.relative_path or "")
        if abs_path.exists():
            self.indexer.index_document(doc, abs_path, self.storage.root_dir)

        return {"success": True, "doc": doc.model_dump(), "conflict": None}

    def cmd_tasks_list(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        status = payload.get("status")
        tasks = self.indexer.list_tasks(status=status)
        for task in tasks:
            path, doc = self._find_document(task["id"], "task")
            task.update(
                description=doc.body,
                revision=doc.metadata.revision,
                base_hash=doc.body_hash,
                file_hash=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
        return {"tasks": tasks}

    def cmd_tasks_update(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        task_id = payload.get("id")
        if not task_id:
            raise ValueError("Task ID is required")
        new_status = payload.get("status")
        title = payload.get("title")
        due_date = payload.get("due_date")

        # Read existing task
        task_path = (self.storage.tasks_dir / f"{task_id}.md").resolve()
        if task_path.parent != self.storage.tasks_dir.resolve():
            raise ValueError("Invalid task ID")
        doc = self.storage.read_document(task_path)
        if not doc:
            raise FileNotFoundError(f"Task {task_id} not found")

        if (
            payload.get("file_hash", hashlib.sha256(task_path.read_bytes()).hexdigest())
            != hashlib.sha256(task_path.read_bytes()).hexdigest()
            or payload.get("revision", doc.metadata.revision) != doc.metadata.revision
            or payload.get("base_hash", doc.body_hash) != doc.body_hash
        ):
            raise ValueError("CONFLICT: задача изменена, перечитайте её")
        doc.metadata.updated_at = datetime.now().isoformat()
        if title:
            doc.metadata.title = title
        if "due_date" in payload:
            doc.metadata.extra["due_date"] = due_date
        if new_status is not None:
            new_status = TaskStatus(new_status).value
            doc.metadata.extra["status"] = new_status
            doc.metadata.tags = ["task", new_status]
        if "description" in payload:
            doc.body = payload["description"]

        success, conflict = self.storage.write_document(
            doc,
            task_path,
            expected_base_hash=doc.body_hash,
            base_revision=doc.metadata.revision,
            expected_file_hash=payload.get("file_hash"),
        )
        if conflict:
            self.indexer.record_conflict(conflict)
            return {"success": False, "conflict": conflict.model_dump()}

        self.indexer.index_document(doc, task_path, self.storage.root_dir)
        return {"success": True}

    def _safe_path(self, value):
        if not isinstance(value, str) or not value:
            raise ValueError("Invalid path")
        path = (self.storage.root_dir / value).resolve()
        if not path.is_relative_to(self.storage.root_dir.resolve()):
            raise ValueError("Path outside memory")
        return path

    def cmd_document_read(self, payload):
        path = self._safe_path(payload.get("path"))
        if path.suffix not in (".md", ".json") or not path.is_file():
            raise ValueError("Document unavailable")
        return {
            "path": str(path.relative_to(self.storage.root_dir)),
            "content": path.read_text(encoding="utf-8"),
        }

    def cmd_conflicts_read(self, payload):
        conflict = next(
            (c for c in self.indexer.list_conflicts() if c["id"] == payload.get("id")),
            None,
        )
        if not conflict:
            raise FileNotFoundError("Conflict not found")
        return {
            **conflict,
            "human": self._safe_path(conflict["canonical_path"]).read_text(
                encoding="utf-8"
            ),
            "app": self._safe_path(conflict["conflict_path"]).read_text(
                encoding="utf-8"
            ),
        }

    def cmd_conflicts_resolve(self, payload):
        conflict = self.cmd_conflicts_read(payload)
        if payload.get("choice") not in ("human", "app"):
            raise ValueError("Choose human or app")
        from memory.parser import parse_markdown_with_frontmatter

        path = self._safe_path(conflict["canonical_path"])
        current = self.storage.read_document(path)
        if (
            payload.get("human") != conflict["human"]
            or payload.get("app") != conflict["app"]
        ):
            raise ValueError("CONFLICT: версии изменились, перечитайте")
        if payload["choice"] == "app":
            chosen = parse_markdown_with_frontmatter(conflict["app"])
            self.storage.write_document(
                chosen, path, expected_base_hash=current.body_hash
            )
            self.indexer.index_document(chosen, path, self.storage.root_dir)
        # Retain both version files as evidence; remove the active notification only.
        with self.indexer._get_connection() as conn:
            conn.execute("DELETE FROM conflicts WHERE id = ?", (payload["id"],))
        return {"success": True}

    def cmd_conflicts_list(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        conflicts = self.indexer.list_conflicts()
        return {"conflicts": conflicts}

    def cmd_search_query(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        query = payload.get("query", "")
        doc_type = payload.get("doc_type")
        limit = payload.get("limit", 20)
        if not isinstance(limit, int) or not 1 <= limit <= 1000:
            raise ValueError("Invalid limit")
        offset = payload.get("offset", 0)
        if not isinstance(offset, int) or offset < 0:
            raise ValueError("Invalid offset")
        if doc_type and doc_type not in (
            "note",
            "task",
            "episode",
            "context",
            "day_index",
        ):
            raise ValueError("Invalid document type")
        for field in ("date_from", "date_to"):
            if payload.get(field):
                datetime.strptime(payload[field], "%Y-%m-%d")
        results = self.indexer.search(
            query=query,
            doc_type=doc_type,
            limit=limit + 1,
            offset=offset,
            sort=payload.get("sort", "relevance"),
            date_from=payload.get("date_from"),
            date_to=payload.get("date_to"),
        )
        return {
            "query": query,
            "results": results[:limit],
            "has_more": len(results) > limit,
            "offset": offset,
        }

    def cmd_qa_ask(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        question = payload.get("question", "")
        if not question:
            return {"answer": "Пожалуйста, введите вопрос.", "sources": []}

        # Step 1: Retrieve relevant sources from indexed memory
        docs = self.indexer.search(query=question, limit=5)

        if (
            not self.gateway.api_key
            and "localhost" not in self.gateway.base_url
            and "127.0.0.1" not in self.gateway.base_url
        ):
            return {
                "request_id": "local",
                "status": "local_search",
                "answer": (
                    (
                        "Локальный поиск — модель не настроена. Найденные выдержки:\n"
                        + "\n".join(
                            d.get("title", "") + ": " + d.get("snippet", "")
                            for d in docs
                        )
                    )
                    if docs
                    else "Локальный поиск: совпадений нет."
                ),
                "sources": docs,
            }

        # Step 2: Use Model Gateway to formulate verified response with sources
        answer_result = self.gateway.generate_answer(
            question=question,
            context_docs=docs,
            mode=self.policy.analysis_mode,
        )
        return answer_result

    def cmd_policy_get(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            **self.policy.get_status_dict(),
            "capture_consent": self.indexer.get_setting("capture_consent", "false")
            == "true",
        }

    def cmd_policy_set_consent(self, payload):
        if not isinstance(payload.get("enabled"), bool):
            raise ValueError("enabled must be boolean")
        self.indexer.set_setting(
            "capture_consent", "true" if payload["enabled"] else "false"
        )
        if not payload["enabled"]:
            self.policy.set_paused(True)
        return self.cmd_policy_get({})

    def cmd_diagnostics_status(self, payload):
        last_error = None
        log = self.storage.root_dir / ".system" / "logs" / "core.jsonl"
        if log.exists():
            try:
                for line in log.read_text(encoding="utf-8").splitlines()[-100:]:
                    event = json.loads(line)
                    if event.get("level") == "ERROR":
                        last_error = event
            except (OSError, ValueError):
                last_error = {"error_code": "LOG_UNAVAILABLE"}
        return {
            "status": "ready",
            "version": PROTOCOL_VERSION,
            "credentials": self.gateway.credentials.status,
            "last_error": last_error,
            "legacy_credentials": bool(
                self.indexer.get_setting("model_api_key")
                or self.indexer.get_setting("nd_api_key")
            ),
            "logs": str(self.storage.root_dir / ".system" / "logs"),
            "memory_root": str(self.storage.root_dir),
        }

    def cmd_policy_set_pause(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        paused = bool(payload.get("paused", False))
        self.policy.set_paused(paused)
        return self.policy.get_status_dict()

    def cmd_policy_add_exclusion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        app_name = payload.get("app")
        domain = payload.get("domain")
        if app_name:
            self.policy.add_excluded_app(app_name)
        if domain:
            self.policy.add_excluded_domain(domain)
        return self.policy.get_status_dict()

    def cmd_policy_remove_exclusion(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        app_name = payload.get("app")
        domain = payload.get("domain")
        if app_name:
            self.policy.remove_excluded_app(app_name)
        if domain:
            self.policy.remove_excluded_domain(domain)
        return self.policy.get_status_dict()

    def cmd_policy_set_privacy_mode(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        mode = payload.get("mode", "raw")
        self.policy.set_privacy_mode(mode)
        return self.policy.get_status_dict()

    def cmd_model_get_config(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "base_url": self.gateway.base_url,
            "api_key": "",
            "has_api_key": bool(self.gateway.api_key),
            "credential_status": self.gateway.credentials.status,
            "text_model": self.gateway.text_model,
            "vision_model": self.gateway.vision_model,
            "model_name": self.gateway.text_model,
            "nd_endpoint": self.gateway.nd_endpoint,
            "nd_api_key": "",
            "has_nd_api_key": bool(self.gateway.nd_api_key),
        }

    def cmd_model_update_config(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        base_url = payload.get("base_url", self.gateway.base_url)
        api_key = (
            ""
            if payload.get("clear_api_key")
            else payload.get("api_key") or self.gateway.api_key
        )
        text_model = payload.get("text_model") or payload.get(
            "model_name", self.gateway.text_model
        )
        vision_model = payload.get("vision_model", self.gateway.vision_model)
        nd_endpoint = payload.get("nd_endpoint")
        nd_api_key = (
            ""
            if payload.get("clear_nd_api_key")
            else payload.get("nd_api_key") or self.gateway.nd_api_key
        )

        self.gateway.update_config(
            base_url=base_url,
            api_key=api_key,
            text_model=text_model,
            vision_model=vision_model,
            nd_endpoint=nd_endpoint,
            nd_api_key=nd_api_key,
        )
        return {"success": True}

    def cmd_model_test_connection(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        model = payload.get("model")
        return self.gateway.test_connection(model=model)

    def cmd_model_test_neuraldeep(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self.gateway.test_neuraldeep_connection()

    def cmd_capture_analyze_screenshot(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        shot_path_str = payload.get("path")
        if not shot_path_str:
            return {"ok": False, "error": "Path to screenshot required"}
        shot_path = Path(shot_path_str)
        if not shot_path.is_absolute():
            shot_path = self.storage.root_dir / shot_path_str
        prompt = payload.get("prompt")
        return self.gateway.analyze_screenshot(shot_path, custom_prompt=prompt)

    def cmd_suggestions_list(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        # Generate suggestions from current context
        active_win = self.window_tracker.get_active_window()
        self.suggestions.generate_suggestions(
            active_window_title=active_win.get("title", ""),
            active_app=active_win.get("app", ""),
        )
        return {"suggestions": [s.model_dump() for s in self.suggestions.list_active()]}

    def cmd_suggestions_dismiss(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        s_id = payload.get("id", "")
        self.suggestions.dismiss(s_id)
        return {"success": True}

    def cmd_capture_get_settings(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "interval_seconds": self.capture_interval_seconds,
            "is_paused": self.policy.is_paused,
        }

    def cmd_capture_set_settings(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if "interval_seconds" in payload:
            sec = max(5, int(payload["interval_seconds"]))
            self.capture_interval_seconds = sec
            self.indexer.set_setting("capture_interval_seconds", str(sec))
        return {
            "interval_seconds": self.capture_interval_seconds,
            "is_paused": self.policy.is_paused,
        }

    def cmd_storage_clean_snapshots(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Manually clean temporary screenshot images while leaving text & notes intact (F06)."""
        res = clean_temporary_screenshots(self.storage.root_dir, max_age_days=None)
        return res

    def cmd_capture_tick(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Capture tick: checks active window, exclusions, takes screenshot every N seconds, and runs OCR."""
        if self.policy.is_paused:
            return {"status": "paused", "recorded": False}
        if self.indexer.get_setting("capture_consent", "false") != "true":
            return {"status": "consent_required", "recorded": False}

        now_ts = time.time()
        now = datetime.now()

        # Check idle time (pause recording if inactive for > 5 minutes)
        idle_sec = self.window_tracker.get_idle_seconds()
        if idle_sec > 300.0:
            return {"status": "idle", "idle_seconds": idle_sec, "recorded": False}

        win_info = self.window_tracker.get_active_window()
        app_name = win_info.get("app", "")
        window_title = win_info.get("title", "")
        url = win_info.get("url", "")

        # Check exclusions
        if not self.policy.is_app_allowed(app_name):
            return {"status": "excluded_app", "app": app_name, "recorded": False}
        if url and not self.policy.is_url_allowed(url):
            return {"status": "excluded_url", "url": url, "recorded": False}

        # Check if capture interval or context switch occurred
        is_context_switch = app_name != self.last_app or window_title != self.last_title
        is_interval_elapsed = (
            now_ts - self.last_capture_time >= self.capture_interval_seconds
        )

        if not is_context_switch and not is_interval_elapsed:
            return {"status": "skipped_interval", "recorded": False}

        self.last_capture_time = now_ts
        self.last_app = app_name
        self.last_title = window_title
        self.last_url = url

        day_dir = self.storage.get_day_dir(now)
        time_prefix = now.strftime("%H-%M-%S")
        shot_id = f"shot-{int(now_ts * 1000)}"
        shot_filename = f"{shot_id}.png"
        shot_path = day_dir / "attachments" / shot_filename

        # 1. Take silent screenshot
        shot_captured = self.screen_capturer.capture_screen(shot_path)
        shot_rel = (
            str(shot_path.relative_to(self.storage.root_dir)) if shot_captured else None
        )

        # 2. Run OCR on screenshot
        ocr_text = ""
        if shot_captured:
            ocr_text = self.screen_capturer.run_ocr(shot_path)

        # 3. Save source metadata JSON (F06, F07)
        source_id = f"obs-{int(now_ts * 1000)}"
        source_rec = SourceRecord(
            id=source_id,
            source_type=SourceType.DESKTOP_WINDOW,
            app_name=app_name,
            window_title=window_title,
            uri=url,
            captured_at=now.isoformat(),
            method=CaptureMethod.OCR if ocr_text else CaptureMethod.DIRECT_TEXT,
            metadata={
                "screenshot": shot_rel,
                "has_ocr": bool(ocr_text),
                "url": url,
            },
        )
        self.storage.save_source_record(source_rec, now)

        # 4. Save full context document (STORAGE.md context/HH-MM-SS_obs-<id>.md)
        if ocr_text or window_title:
            context_body = (
                f"# Контекст: {window_title}\n\n"
                f"- **Приложение:** {app_name}\n"
                f"- **URL:** {url or 'Локальное приложение'}\n"
                f"- **Снимок экрана:** {shot_rel or 'Нет'}\n\n"
                f"## Распознанный текст на экране\n\n{ocr_text or 'Текст не обнаружен'}\n"
            )
            context_doc = MemoryDocument(
                metadata=DocMetadata(
                    id=source_id,
                    title=f"Контекст: {app_name} - {window_title}"[:80],
                    doc_type=DocumentType.CONTEXT,
                    created_at=now.isoformat(),
                    updated_at=now.isoformat(),
                    source_id=source_id,
                ),
                body=context_body,
            )
            ctx_path = day_dir / "context" / f"{time_prefix}_{source_id}.md"
            self.storage.write_document(context_doc, ctx_path)
            self.indexer.index_document(context_doc, ctx_path, self.storage.root_dir)

        # 5. If context switch or first capture of episode, save work episode
        ep = None
        if is_context_switch or not hasattr(self, "_current_episode_id"):
            summary = f"Работа в приложении {app_name}: {window_title}"
            observations = f"Активное окно: {window_title} ({app_name})"
            if url:
                observations += f"\nСтраница: {url}"
            if ocr_text:
                observations += f"\nКонтекст на экране: {ocr_text[:300]}..."

            ep = self.storage.save_episode(
                summary=summary,
                observations=observations,
                dt=now,
                source_ids=[source_id],
            )
            self._current_episode_id = ep.metadata.id
            ep_path = self.storage.root_dir / ep.relative_path
            if ep_path.exists():
                self.indexer.index_document(ep, ep_path, self.storage.root_dir)

        # Update day index
        self.storage.update_day_index(now)

        return {
            "status": "recorded",
            "recorded": True,
            "source_id": source_id,
            "screenshot": shot_rel,
            "has_ocr": bool(ocr_text),
            "app": app_name,
            "title": window_title,
            "url": url,
        }

    def shutdown(self) -> None:
        self.watcher.stop()
