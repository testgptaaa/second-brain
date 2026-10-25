"""Unit test for filesystem watcher and automatic external edit reindexing."""
import tempfile
import time
from pathlib import Path
import pytest

from index.indexer import Indexer
from memory.models import DocMetadata, DocumentType, MemoryDocument
from memory.storage import MemoryStorage
from watcher.observer import MemoryWatcher


def test_watcher_detects_external_file_edit():
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = MemoryStorage(tmp_dir)
        storage.init_storage()
        indexer = Indexer(storage.sqlite_path)

        events_received = []

        def on_change(doc, path):
            events_received.append((doc, path))

        watcher = MemoryWatcher(
            storage=storage,
            indexer=indexer,
            on_change_callback=on_change,
        )
        watcher.handler.debounce_seconds = 0.1
        watcher.start()

        try:
            # 1. Create a note through storage
            doc, _ = storage.save_note(
                title="Первичная заметка",
                content="Текст заметки номер один.",
                doc_id="watch-test-1",
            )
            note_file = storage.root_dir / doc.relative_path
            indexer.index_document(doc, note_file, storage.root_dir)

            time.sleep(0.3)
            # App write journal should ignore our own write
            assert len(events_received) == 0

            # 2. Simulate external edit by user in Obsidian / external editor
            updated_content = """---
id: watch-test-1
title: Первичная заметка
doc_type: note
revision: 1
---

Внешне отредактированный текст с уникальным словом СИНХРОНИЗАЦИЯ.
"""
            note_file.write_text(updated_content, encoding="utf-8")

            # Wait for watcher debounce and stabilization
            time.sleep(0.8)

            # Watcher must have detected the external edit
            assert len(events_received) >= 1
            last_doc, last_path = events_received[-1]
            assert "СИНХРОНИЗАЦИЯ" in last_doc.body

            # Index should be updated with new text
            search_res = indexer.search("СИНХРОНИЗАЦИЯ")
            assert len(search_res) == 1

        finally:
            watcher.stop()
