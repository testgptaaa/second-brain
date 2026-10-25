"""Watchdog-based filesystem watcher with debouncing, stabilization, and hash validation."""
from __future__ import annotations

import os
import threading
import time
from pathlib import Path
from typing import Callable, Dict, Optional, Set
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from memory.models import MemoryDocument, compute_body_hash
from memory.parser import parse_markdown_with_frontmatter
from memory.storage import MemoryStorage
from index.indexer import Indexer


class StorageFileEventHandler(FileSystemEventHandler):
    IGNORED_PATTERNS = (".tmp", ".swp", ".crdownload", ".part", "~$", ".DS_Store", "Thumbs.db")

    def __init__(
        self,
        storage: MemoryStorage,
        indexer: Indexer,
        on_change_callback: Optional[Callable[[MemoryDocument, str], None]] = None,
        debounce_seconds: float = 0.4,
    ):
        super().__init__()
        self.storage = storage
        self.indexer = indexer
        self.on_change_callback = on_change_callback
        self.debounce_seconds = debounce_seconds

        self._pending_paths: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._running = True

        # Debounce worker thread
        self._worker_thread = threading.Thread(target=self._process_pending_loop, daemon=True)
        self._worker_thread.start()

    def _is_ignored(self, path_str: str) -> bool:
        p = Path(path_str)
        # Ignore system directories
        parts = p.parts
        if ".system" in parts or "conflicts" in parts:
            return True
        name = p.name
        if name == "README.md":
            return True
        if name.startswith(".") or any(name.endswith(ext) for ext in self.IGNORED_PATTERNS):
            return True
        if any(name.startswith(pfx) for pfx in ("~$", ".")):
            return True
        if not name.endswith(".md") and not name.endswith(".json"):
            return True
        return False

    def on_modified(self, event: FileSystemEvent) -> None:
        if not event.is_directory and not self._is_ignored(event.src_path):
            self._queue_path(event.src_path)

    def on_created(self, event: FileSystemEvent) -> None:
        if not event.is_directory and not self._is_ignored(event.src_path):
            self._queue_path(event.src_path)

    def on_moved(self, event: FileSystemEvent) -> None:
        # Atomic saves (vim, VS Code) often write to a temp file and rename/move to destination
        if hasattr(event, "dest_path") and not event.is_directory and not self._is_ignored(event.dest_path):
            self._queue_path(event.dest_path)

    def _queue_path(self, path_str: str) -> None:
        with self._lock:
            self._pending_paths[path_str] = time.time()

    def _process_pending_loop(self) -> None:
        while self._running:
            time.sleep(0.1)
            now = time.time()
            to_process = []

            with self._lock:
                for path_str, timestamp in list(self._pending_paths.items()):
                    if now - timestamp >= self.debounce_seconds:
                        to_process.append(path_str)
                        del self._pending_paths[path_str]

            for path_str in to_process:
                self._handle_stabilized_file(path_str)

    def _handle_stabilized_file(self, path_str: str) -> None:
        target_path = Path(path_str).resolve()
        if not target_path.exists():
            return

        # Check stabilization: wait until size and mtime are stable
        try:
            stat1 = target_path.stat()
            time.sleep(0.05)
            stat2 = target_path.stat()
            if stat1.st_size != stat2.st_size or stat1.st_mtime != stat2.st_mtime:
                # File is still being written; re-queue
                self._queue_path(path_str)
                return
        except OSError:
            return

        if not target_path.name.endswith(".md"):
            return

        try:
            content = target_path.read_text(encoding="utf-8")
        except Exception:
            return

        doc = parse_markdown_with_frontmatter(content, default_id=target_path.stem)
        body_hash = doc.recalculate_hash()

        # Check if this change was initiated by our own app write
        abs_key = str(target_path)
        journaled = self.storage.app_write_journal.get(abs_key)
        if journaled:
            journal_ts, journal_hash = journaled
            # If hash matches our recent app write within 10 seconds, ignore echo
            if journal_hash == body_hash and (time.time() - journal_ts) < 10.0:
                return

        # This is an EXTERNAL EDIT!
        # Archive prior version in .system/versions before updating index
        self.storage._archive_previous_version(
            doc.metadata.id,
            doc.metadata.revision,
            content,
        )

        # Update index
        self.indexer.index_document(doc, target_path, self.storage.root_dir)

        # Notify callback
        if self.on_change_callback:
            try:
                self.on_change_callback(doc, str(target_path))
            except Exception:
                pass

    def stop(self) -> None:
        self._running = False


class MemoryWatcher:
    def __init__(
        self,
        storage: MemoryStorage,
        indexer: Indexer,
        on_change_callback: Optional[Callable[[MemoryDocument, str], None]] = None,
    ):
        self.storage = storage
        self.indexer = indexer
        self.on_change_callback = on_change_callback
        self.observer = Observer()
        self.handler = StorageFileEventHandler(
            storage=storage,
            indexer=indexer,
            on_change_callback=on_change_callback,
        )

    def start(self) -> None:
        self.observer.schedule(self.handler, str(self.storage.root_dir), recursive=True)
        self.observer.start()

    def stop(self) -> None:
        self.handler.stop()
        self.observer.stop()
        self.observer.join(timeout=2.0)
