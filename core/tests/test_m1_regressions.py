"""Behavioral regressions found in the M1 audit; all memory is temporary."""

from datetime import datetime
from pathlib import Path
import pytest
from ipc.handler import IPCHandler


@pytest.fixture
def handler(tmp_path):
    instance = IPCHandler(str(tmp_path))
    yield instance
    instance.shutdown()


def test_settings_roundtrip_preserves_key(handler):
    handler.gateway.update_config("https://example.invalid/v1", "synthetic-marker")
    cfg = handler.cmd_model_get_config({})
    handler.cmd_model_update_config(cfg)
    assert handler.gateway.api_key == "synthetic-marker"
    handler.cmd_model_update_config(
        {"base_url": cfg["base_url"], "text_model": "another"}
    )
    assert handler.gateway.api_key == "synthetic-marker"


def test_rebuild_removes_deleted_note_and_preserves_settings(handler):
    result = handler.cmd_notes_create(
        {"title": "Удаление", "content": "UniqueDeletionMarker"}
    )
    path = handler.storage.root_dir / result["doc"]["relative_path"]
    assert (
        len(handler.cmd_search_query({"query": "UniqueDeletionMarker"})["results"]) == 1
    )
    handler.indexer.set_setting("test-setting", "keep")
    path.unlink()
    handler.cmd_storage_sync({})
    handler.cmd_storage_sync({})
    assert handler.cmd_search_query({"query": "UniqueDeletionMarker"})["results"] == []
    assert handler.indexer.get_setting("test-setting") == "keep"


def test_edit_yesterday_note_preserves_identity(handler):
    doc, _ = handler.storage.save_note("Вчера", "old", dt=datetime(2026, 1, 1))
    handler.storage.save_note("Сегодня", "new", doc_id=doc.metadata.id)
    matches = list(handler.storage.days_dir.glob(f"*/*/*/notes/*_{doc.metadata.id}.md"))
    assert len(matches) == 1
    updated = handler.storage.read_document(matches[0])
    assert updated.metadata.created_at == doc.metadata.created_at
    assert updated.body == "new\n"


def test_note_crud_and_search(handler):
    result = handler.cmd_notes_create({"title": "CRUD", "content": "before"})
    note_id = result["doc"]["metadata"]["id"]
    assert handler.cmd_notes_update({"id": note_id, "content": "UpdatedUniqueMarker"})[
        "success"
    ]
    assert handler.cmd_notes_list({})["notes"][0]["content"] == "UpdatedUniqueMarker\n"
    assert handler.cmd_search_query({"query": "UpdatedUniqueMarker"})["results"]
    handler.cmd_notes_delete({"id": note_id})
    assert not handler.cmd_notes_list({})["notes"]
    assert not handler.cmd_search_query({"query": "UpdatedUniqueMarker"})["results"]


def test_task_patch_preserves_status_and_clears_due(handler):
    result = handler.cmd_tasks_create(
        {"title": "Task", "status": "in_progress", "due_date": "2026-10-25"}
    )
    task_id = result["doc"]["metadata"]["id"]
    handler.cmd_tasks_update({"id": task_id, "due_date": None})
    task = handler.cmd_tasks_list({})["tasks"][0]
    assert task["status"] == "in_progress"
    assert task["due_date"] is None


def test_capture_without_consent_never_calls_adapter(handler, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("capture adapter called without consent")

    monkeypatch.setattr(handler.screen_capturer, "capture_screen", forbidden)
    assert handler.cmd_capture_tick({})["status"] == "consent_required"


def test_task_path_escape_rejected(handler):
    with pytest.raises(ValueError):
        handler.cmd_tasks_update({"id": "../../outside", "status": "done"})


def test_credentials_not_saved_to_sqlite_and_dto_never_returns_them(handler):
    handler.cmd_model_update_config({"api_key": "synthetic-dto-marker"})
    assert handler.indexer.get_setting("model_api_key") in (None, "")
    cfg = handler.cmd_model_get_config({})
    assert cfg["has_api_key"] is True
    assert cfg["api_key"] == ""
    handler.cmd_model_update_config({"clear_api_key": True})
    assert not handler.gateway.api_key


def test_stale_note_revision_cannot_overwrite_newer_content(handler):
    handler.cmd_notes_create({"title": "One", "content": "old"})
    snapshot = handler.cmd_notes_list({})["notes"][0]
    handler.cmd_notes_update({**snapshot, "content": "new"})
    with pytest.raises(ValueError, match="CONFLICT"):
        handler.cmd_notes_update({**snapshot, "content": "stale"})
    assert handler.cmd_notes_list({})["notes"][0]["content"] == "new\n"


def test_document_read_rejects_escape_and_symlink(handler, tmp_path):
    outside = tmp_path.parent / (tmp_path.name + "-outside.md")
    outside.write_text("private")
    try:
        (tmp_path / "link.md").symlink_to(outside)
        with pytest.raises(ValueError):
            handler.cmd_document_read({"path": "link.md"})
        with pytest.raises(ValueError):
            handler.cmd_document_read({"path": "../outside.md"})
        handler.cmd_storage_sync({})
        assert not handler.cmd_search_query({"query": "private"})["results"]
    finally:
        outside.unlink()


def test_validation_rejects_invalid_input_before_writing(handler):
    for payload in (
        {"title": " "},
        {"title": "valid", "status": "invalid"},
        {"title": "valid", "due_date": "yesterday"},
        {"title": "valid", "id": "../escape"},
    ):
        result = handler.handle_request({"type": "tasks:create", "payload": payload})
        assert result["error"]
    assert handler.cmd_tasks_list({})["tasks"] == []


def test_delete_is_repeatable(handler):
    result = handler.cmd_notes_create({"title": "Delete once"})
    payload = {"id": result["doc"]["metadata"]["id"]}
    assert handler.cmd_notes_delete(payload)["success"]
    assert handler.cmd_notes_delete(payload)["success"]


def test_tls_verification_is_enabled(handler, monkeypatch):
    import httpx

    real = httpx.Client
    calls = []

    def checked(*args, **kwargs):
        assert kwargs.get("verify", True) is not False
        calls.append(kwargs)
        return real(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(401, json={"error": "unauthorized"})
            ),
            **kwargs,
        )

    monkeypatch.setattr(httpx, "Client", checked)
    assert handler.gateway.test_connection()["status_code"] == 401
    assert handler.gateway.test_neuraldeep_connection()["status_code"] == 401
    assert len(calls) == 2


def test_operational_logs_are_json_without_payload_or_secret(handler, tmp_path):
    import json
    from diagnostics import configure

    configure(tmp_path / "logs")
    handler.handle_request(
        {
            "type": "tasks:create",
            "request_id": "correlated-id",
            "payload": {"title": "private-note-marker", "status": "bad"},
        }
    )
    content = (tmp_path / "logs/core.jsonl").read_text()
    event = json.loads(content.strip().splitlines()[-1])
    assert event["request_id"] == "correlated-id"
    assert event["error_code"] == "ValueError"
    assert event["trace"]
    assert "private-note-marker" not in content


def test_keychain_migration_verifies_before_clearing_sqlite(handler, monkeypatch):
    from gateway.client import ModelGateway

    class FakeStore:
        backend = True
        error = None
        values = {}

        def __init__(self, root):
            pass

        def get(self, name):
            return self.values.get(name, "")

        def put(self, name, value):
            self.values[name] = value

    monkeypatch.setattr("gateway.client.CredentialStore", FakeStore)
    handler.indexer.set_setting("model_api_key", "legacy-synthetic")
    gateway = ModelGateway(handler.storage, handler.indexer)
    assert gateway.api_key == "legacy-synthetic"
    assert handler.indexer.get_setting("model_api_key") == ""
    assert FakeStore.values["model_api_key"] == "legacy-synthetic"

    class BrokenStore(FakeStore):
        def put(self, name, value):
            raise RuntimeError("unavailable")

    monkeypatch.setattr("gateway.client.CredentialStore", BrokenStore)
    handler.indexer.set_setting("model_api_key", "recoverable-legacy")
    ModelGateway(handler.storage, handler.indexer)
    assert handler.indexer.get_setting("model_api_key") == "recoverable-legacy"


def test_conflict_read_and_explicit_resolution_preserve_versions(handler):
    result = handler.cmd_notes_create({"title": "Conflict", "content": "original"})
    path = handler.storage.root_dir / result["doc"]["relative_path"]
    doc = handler.storage.read_document(path)
    old_hash = doc.body_hash
    path.write_text(path.read_text().replace("original", "human edit"))
    doc.body = "app edit"
    ok, conflict = handler.storage.write_document(
        doc, path, expected_base_hash=old_hash
    )
    assert not ok
    handler.indexer.record_conflict(conflict)
    comparison = handler.cmd_conflicts_read({"id": conflict.id})
    with pytest.raises(ValueError, match="CONFLICT"):
        handler.cmd_conflicts_resolve(
            {**comparison, "human": "outdated", "choice": "app"}
        )
    assert handler.cmd_conflicts_resolve({**comparison, "choice": "app"})["success"]
    assert "app edit" in path.read_text()
    assert (handler.storage.root_dir / conflict.conflict_path).exists()
    assert not handler.cmd_conflicts_list({})["conflicts"]


def test_slow_rpc_does_not_block_pause_and_queue_is_bounded(tmp_path):
    import json, os, select, subprocess, sys, time

    source = Path(__file__).resolve().parents[1] / "src"
    wrapper = tmp_path / "slow.py"
    wrapper.write_text(
        f"import sys,runpy,time\nsys.path.insert(0,{str(source)!r})\nfrom gateway.client import ModelGateway\ndef slow(self,model=None):\n time.sleep(2)\n return {{'ok':True}}\nModelGateway.test_connection=slow\nrunpy.run_path({str(source/'main.py')!r},run_name='__main__')\n"
    )
    process = subprocess.Popen(
        [sys.executable, str(wrapper), "--memory-root", str(tmp_path / "memory")],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )

    def line(deadline):
        assert select.select([process.stdout], [], [], deadline)[
            0
        ], "response deadline exceeded"
        return json.loads(process.stdout.readline())

    try:
        assert line(5)["event"] == "engine:ready"
        commands = [
            {"request_id": str(i), "type": "model:test_connection", "payload": {}}
            for i in range(3)
        ]
        commands.append(
            {
                "request_id": "pause",
                "type": "policy:set_pause",
                "payload": {"paused": True},
            }
        )
        started = time.monotonic()
        process.stdin.write(("".join(json.dumps(r) + "\n" for r in commands)).encode())
        process.stdin.flush()
        responses = [line(1), line(1)]
        assert time.monotonic() - started < 1.5
        assert any(r.get("error", "").startswith("BUSY") for r in responses)
        assert any(
            r.get("request_id") == "pause" and r["payload"]["is_paused"]
            for r in responses
        )
    finally:
        process.terminate()
        try:
            process.wait(timeout=6)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def test_metadata_only_external_edit_is_detected(handler):
    handler.cmd_notes_create({"title": "Old title", "content": "unchanged body"})
    snapshot = handler.cmd_notes_list({})["notes"][0]
    path, _ = handler._find_document(snapshot["id"], "note")
    path.write_text(path.read_text().replace("Old title", "External title"))
    with pytest.raises(ValueError, match="CONFLICT"):
        handler.cmd_notes_update({**snapshot, "title": "My stale title"})
    assert "External title" in path.read_text()


def test_search_sort_filters_and_pages_apply_to_whole_index(handler):
    from datetime import timedelta

    for i in range(51):
        dt = datetime(2026, 1, 1) + timedelta(days=i)
        doc, _ = handler.storage.save_note(
            f"Note {i}", "SharedSearchToken", doc_id=f"note-{i:03}", dt=dt
        )
        doc.metadata.updated_at = dt.isoformat()
        path = handler.storage.root_dir / doc.relative_path
        handler.storage.write_document(doc, path)
        handler.indexer.index_document(doc, path, handler.storage.root_dir)
    ids = []
    for offset in (0, 20, 40):
        result = handler.cmd_search_query(
            {
                "query": "SharedSearchToken",
                "sort": "updated",
                "limit": 20,
                "offset": offset,
                "doc_type": "note",
            }
        )
        ids.extend(r["id"] for r in result["results"])
        assert result["has_more"] is (offset < 40)
    assert ids == [f"note-{i:03}" for i in reversed(range(51))]
    filtered = handler.cmd_search_query(
        {
            "query": "SharedSearchToken",
            "date_from": "2026-01-01",
            "date_to": "2026-01-03",
            "limit": 20,
        }
    )
    assert {r["id"] for r in filtered["results"]} == {
        "note-000",
        "note-001",
        "note-002",
    }
    with pytest.raises(ValueError):
        handler.cmd_search_query(
            {"query": "SharedSearchToken", "sort": "DROP TABLE documents"}
        )
