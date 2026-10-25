"""Unit tests for Memory storage, parsing, hashes, and conflict handling."""
import tempfile
import time
from pathlib import Path
import pytest

from memory.models import DocMetadata, DocumentType, MemoryDocument, compute_body_hash
from memory.parser import parse_markdown_with_frontmatter, serialize_markdown_document
from memory.storage import MemoryStorage


def test_frontmatter_parsing_and_serialization():
    raw_text = """---
id: note-123
title: Тестовая заметка
doc_type: note
created_at: '2026-10-25T14:00:00'
updated_at: '2026-10-25T14:00:00'
revision: 1
tags:
- work
- report
custom_user_field: important_data
---

# Заголовок заметки

Это тело заметки с описанием важного рабочего контекста.
"""
    doc = parse_markdown_with_frontmatter(raw_text)
    assert doc.metadata.id == "note-123"
    assert doc.metadata.title == "Тестовая заметка"
    assert doc.metadata.doc_type == DocumentType.NOTE
    assert doc.metadata.revision == 1
    assert "work" in doc.metadata.tags
    assert doc.metadata.extra.get("custom_user_field") == "important_data"
    assert "Это тело заметки" in doc.body

    # Check hash does not depend on YAML frontmatter
    initial_hash = doc.recalculate_hash()
    assert initial_hash == compute_body_hash(doc.body)

    # Serialize back and ensure custom user field is preserved
    serialized = serialize_markdown_document(doc)
    assert "custom_user_field: important_data" in serialized
    assert "Тестовая заметка" in serialized


def test_conflict_preservation():
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = MemoryStorage(tmp_dir)
        storage.init_storage()

        # Step 1: Save initial note
        note, conflict = storage.save_note(
            title="Договорённость с клиентом",
            content="Согласовали поставку к 1 ноября.",
            doc_id="note-agreement",
        )
        assert conflict is None
        assert note.metadata.id == "note-agreement"

        target_file = storage.root_dir / note.relative_path
        assert target_file.exists()

        # Step 2: Simulate human editing the file externally with another editor (e.g. Obsidian)
        human_content = """---
id: note-agreement
title: Договорённость с клиентом
doc_type: note
revision: 1
---

Согласовали поставку к 15 ноября (перенос по звонку клиента).
"""
        target_file.write_text(human_content, encoding="utf-8")

        # Step 3: Now the app attempts to write with old expected base hash
        divergent_doc = MemoryDocument(
            metadata=DocMetadata(
                id="note-agreement",
                title="Договорённость с клиентом",
                revision=1,
            ),
            body="Автоматическое обновление: поставка к 5 ноября.",
        )

        old_base_hash = compute_body_hash("Согласовали поставку к 1 ноября.")
        success, conflict = storage.write_document(
            divergent_doc,
            target_file,
            expected_base_hash=old_base_hash,
            base_revision=1,
        )

        # Conflict MUST be detected!
        assert success is False
        assert conflict is not None
        assert conflict.doc_id == "note-agreement"

        # The human version MUST remain untouched at the canonical location
        current_canonical = target_file.read_text(encoding="utf-8")
        assert "15 ноября" in current_canonical

        # The app's diverging version MUST be in conflicts/
        conflict_file = storage.root_dir / conflict.conflict_path
        assert conflict_file.exists()
        assert "5 ноября" in conflict_file.read_text(encoding="utf-8")

        # Conflict metadata JSON MUST exist
        meta_file = storage.root_dir / conflict.metadata_path
        assert meta_file.exists()
