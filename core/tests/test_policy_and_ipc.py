"""Unit tests for Policy Engine and IPC Protocol."""
import tempfile
from pathlib import Path
import pytest

from ipc.handler import IPCHandler


def test_ipc_commands_lifecycle():
    with tempfile.TemporaryDirectory() as tmp_dir:
        handler = IPCHandler(tmp_dir)

        # 1. Ping
        res_ping = handler.handle_request({"request_id": "1", "type": "ping", "payload": {}})
        assert res_ping["error"] is None
        assert res_ping["payload"]["pong"] is True

        # 2. Policy test
        res_pol = handler.handle_request({"request_id": "2", "type": "policy:get", "payload": {}})
        assert res_pol["payload"]["is_paused"] is False

        # Set pause
        handler.handle_request({"request_id": "3", "type": "policy:set_pause", "payload": {"paused": True}})
        res_pol_after = handler.handle_request({"request_id": "4", "type": "policy:get", "payload": {}})
        assert res_pol_after["payload"]["is_paused"] is True

        # When paused, capture tick does not record
        tick_paused = handler.handle_request({"request_id": "5", "type": "capture:tick", "payload": {}})
        assert tick_paused["payload"]["recorded"] is False

        # Unpause
        handler.handle_request({"request_id": "6", "type": "policy:set_pause", "payload": {"paused": False}})

        # 3. Create Note
        note_res = handler.handle_request({
            "request_id": "7",
            "type": "notes:create",
            "payload": {
                "title": "Звонок с клиентом ООО Вектор",
                "content": "Обсудили продление договора на следующий квартал.",
                "tags": ["клиент", "вектор"],
            },
        })
        assert note_res["payload"]["success"] is True

        # 4. Search Note
        search_res = handler.handle_request({
            "request_id": "8",
            "type": "search:query",
            "payload": {"query": "Вектор"},
        })
        assert len(search_res["payload"]["results"]) == 1

        # 5. QA Ask
        qa_res = handler.handle_request({
            "request_id": "9",
            "type": "qa:ask",
            "payload": {"question": "Вектор договор"},
        })
        assert len(qa_res["payload"]["sources"]) >= 1
        assert "Вектор" in qa_res["payload"]["answer"]

        # 6. Tasks
        task_res = handler.handle_request({
            "request_id": "10",
            "type": "tasks:create",
            "payload": {
                "title": "Отправить счёт ООО Вектор",
                "due_date": "2026-11-01T12:00:00",
            },
        })
        assert task_res["payload"]["success"] is True

        tasks_list = handler.handle_request({"request_id": "11", "type": "tasks:list", "payload": {}})
        assert len(tasks_list["payload"]["tasks"]) == 1

        handler.shutdown()
