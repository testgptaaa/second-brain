"""Unit tests for SQLite FTS5 indexer and rebuild functionality."""
import tempfile
from pathlib import Path
import pytest

from memory.storage import MemoryStorage
from index.indexer import Indexer


def test_indexing_search_and_rebuild():
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = MemoryStorage(tmp_dir)
        storage.init_storage()
        indexer = Indexer(storage.sqlite_path)

        # 1. Create notes and tasks
        doc1, _ = storage.save_note(
            title="Отчёт по проекту Альфа",
            content="Согласован бюджет проекта в размере 500000 рублей. Ответственный Иванов.",
            tags=["бюджет", "альфа"],
        )
        file1 = storage.root_dir / doc1.relative_path
        indexer.index_document(doc1, file1, storage.root_dir)

        doc2, _ = storage.save_task(
            title="Подготовить презентацию для руководства",
            description="Собрать слайды с графиками из отчёта проекта Альфа.",
            due_date="2026-10-30T18:00:00",
        )
        file2 = storage.root_dir / doc2.relative_path
        indexer.index_document(doc2, file2, storage.root_dir)

        # 2. Test FTS search
        results_budget = indexer.search("бюджет")
        assert len(results_budget) >= 1
        assert "500000" in results_budget[0]["snippet"]

        results_alpha = indexer.search("Альфа")
        assert len(results_alpha) >= 2

        # 3. Test list tasks
        tasks = indexer.list_tasks(status="todo")
        assert len(tasks) == 1
        assert tasks[0]["title"] == "Подготовить презентацию для руководства"

        # 4. Simulate complete loss of SQLite database and rebuild from files
        del indexer
        storage.sqlite_path.unlink()
        assert not storage.sqlite_path.exists()

        # Reopen indexer and rebuild
        new_indexer = Indexer(storage.sqlite_path)
        indexed_count = new_indexer.rebuild_from_storage(storage.root_dir)
        assert indexed_count == 2

        # Search works again!
        recovered = new_indexer.search("руководства")
        assert len(recovered) == 1
        assert "презентацию" in recovered[0]["title"]
