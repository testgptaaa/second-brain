import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from index.indexer import Indexer
from memory.storage import MemoryStorage
from gateway.client import ModelGateway
from ipc.handler import IPCHandler


def test_gateway_configuration_and_models():
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = MemoryStorage(tmp_dir)
        storage.init_storage()
        indexer = Indexer(storage.sqlite_path)

        gateway = ModelGateway(storage, indexer)
        # Check defaults / env
        assert gateway.text_model == "gpt-5.6-luna"
        assert gateway.vision_model == "gemini-3-flash"

        # Update config
        gateway.update_config(
            base_url="https://api.sd1.su/v1",
            api_key="test-key",
            text_model="gpt-5.6-luna",
            vision_model="gemini-3-flash",
            nd_endpoint="https://api.neuraldeep.ru/v1",
            nd_api_key="test-nd-key",
        )

        assert gateway.text_model == "gpt-5.6-luna"
        assert gateway.vision_model == "gemini-3-flash"
        assert indexer.get_setting("text_model") == "gpt-5.6-luna"
        assert indexer.get_setting("vision_model") == "gemini-3-flash"
        assert indexer.get_setting("nd_endpoint") == "https://api.neuraldeep.ru/v1"


def test_gateway_analyze_screenshot():
    with tempfile.TemporaryDirectory() as tmp_dir:
        storage = MemoryStorage(tmp_dir)
        storage.init_storage()
        indexer = Indexer(storage.sqlite_path)
        gateway = ModelGateway(storage, indexer)

        # Create dummy image
        img_path = Path(tmp_dir) / "test.png"
        img_path.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde")

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "На экране открыт Excel с отчетом"}}],
            "usage": {"prompt_tokens": 120, "completion_tokens": 15},
        }

        with patch("httpx.Client.post", return_value=mock_resp):
            res = gateway.analyze_screenshot(img_path)
            assert res["ok"] is True
            assert "Excel" in res["analysis"]
            assert res["tokens"]["completion"] == 15

            # Verify audit log saved
            day_dir = storage.get_day_dir()
            req_files = list((day_dir / "requests").glob("req-*.json"))
            assert len(req_files) == 1


def test_ipc_model_config_commands():
    with tempfile.TemporaryDirectory() as tmp_dir:
        handler = IPCHandler(tmp_dir)
        try:
            res = handler.handle_request({
                "request_id": "r1",
                "type": "model:get_config",
                "payload": {},
            })
            assert res["error"] is None
            assert res["payload"]["text_model"] == "gpt-5.6-luna"
            assert res["payload"]["vision_model"] == "gemini-3-flash"

            res2 = handler.handle_request({
                "request_id": "r2",
                "type": "model:update_config",
                "payload": {
                    "base_url": "https://api.sd1.su/v1",
                    "api_key": "new_key",
                    "text_model": "gpt-5.6-luna",
                    "vision_model": "gemini-3-flash",
                },
            })
            assert res2["payload"]["success"] is True
        finally:
            handler.shutdown()
