"""Operational metadata only. Never serialize payloads, exception text or secrets."""

import json
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone
import uuid
import traceback
from pathlib import Path

logging.raiseExceptions = False

logger = logging.getLogger("second_brain")
session_id = uuid.uuid4().hex


def configure(directory):
    for old in list(logger.handlers):
        old.close()
        logger.removeHandler(old)
    try:
        directory.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(
            directory / "core.jsonl",
            maxBytes=5 * 1024 * 1024,
            backupCount=4,
            encoding="utf-8",
        )
    except OSError:
        handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False


def record(event, request_id="", duration_ms=0, error_code=None):
    logger.info(
        json.dumps(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": "ERROR" if error_code else "INFO",
                "component": "core.ipc",
                "event": event,
                "session_id": session_id,
                "request_id": request_id,
                "duration_ms": round(duration_ms, 2),
                "error_code": error_code,
                "trace": (
                    [
                        {
                            "file": Path(f.filename).name,
                            "function": f.name,
                            "line": f.lineno,
                        }
                        for f in traceback.extract_tb(__import__("sys").exc_info()[2])
                    ]
                    if error_code
                    else []
                ),
            }
        )
    )
