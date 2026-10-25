"""Unit tests for Screen capture, OCR adapter, cleaner, and PII anonymization."""
import tempfile
from pathlib import Path
import pytest

from adapters.cleaner import clean_temporary_screenshots
from policy.privacy import TextPrivacyEngine
from ipc.handler import IPCHandler


def test_pii_anonymization():
    engine = TextPrivacyEngine(mode="pseudonymize")
    raw_text = (
        "Свяжитесь с клиентом по телефону +7 (999) 123-45-67 или напишите на ivan@vector.ru. "
        "Повторный номер: 89991234567."
    )
    masked, mapping = engine.anonymize_text(raw_text)

    # Phone and email must be masked!
    assert "+7 (999) 123-45-67" not in masked
    assert "ivan@vector.ru" not in masked
    assert "[EMAIL_" in masked
    assert "[ТЕЛЕФОН_" in masked

    # Raw mode test
    engine_raw = TextPrivacyEngine(mode="raw")
    raw_res, map_raw = engine_raw.anonymize_text(raw_text)
    assert raw_res == raw_text
    assert map_raw == {}


def test_temporary_screenshots_cleanup():
    with tempfile.TemporaryDirectory() as tmp_dir:
        root = Path(tmp_dir)
        attachments_dir = root / "days" / "2026" / "10" / "25" / "attachments"
        notes_dir = root / "days" / "2026" / "10" / "25" / "notes"
        attachments_dir.mkdir(parents=True, exist_ok=True)
        notes_dir.mkdir(parents=True, exist_ok=True)

        # Create dummy screenshots
        shot1 = attachments_dir / "shot-1.png"
        shot2 = attachments_dir / "shot-2.png"
        shot1.write_bytes(b"PNG_DUMMY_DATA_1" * 100)
        shot2.write_bytes(b"PNG_DUMMY_DATA_2" * 200)

        # Create dummy note that MUST NOT be deleted
        note_file = notes_dir / "14-00-00_note-1.md"
        note_file.write_text("# Важная заметка\nСодержимое заметки", encoding="utf-8")

        # Run cleaner
        res = clean_temporary_screenshots(root, max_age_days=None)
        assert res["deleted_count"] == 2
        assert res["freed_bytes"] > 0

        # Screenshots must be gone
        assert not shot1.exists()
        assert not shot2.exists()

        # Note MUST be preserved intact!
        assert note_file.exists()
        assert "Важная заметка" in note_file.read_text(encoding="utf-8")


def test_capture_interval_settings_ipc():
    with tempfile.TemporaryDirectory() as tmp_dir:
        handler = IPCHandler(tmp_dir)

        # Get settings
        get_res = handler.handle_request({"request_id": "1", "type": "capture:get_settings", "payload": {}})
        assert get_res["payload"]["interval_seconds"] == 15

        # Update settings to 20 seconds
        set_res = handler.handle_request({
            "request_id": "2",
            "type": "capture:set_settings",
            "payload": {"interval_seconds": 20},
        })
        assert set_res["payload"]["interval_seconds"] == 20
        assert handler.capture_interval_seconds == 20

        handler.shutdown()
