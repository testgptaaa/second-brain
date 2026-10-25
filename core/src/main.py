"""Main entrypoint for second-brain-core Python process."""

from __future__ import annotations

import argparse
import json
import os
import signal
import threading
from concurrent.futures import ThreadPoolExecutor
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add core/src to sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

# Load .env file from project root or current working dir
load_dotenv(Path(__file__).parent.parent.parent / ".env")
load_dotenv()

from ipc.handler import IPCHandler
from diagnostics import configure
from protocol import emit


def main() -> None:
    parser = argparse.ArgumentParser(description="Second Brain Core Engine")
    parser.add_argument(
        "--memory-root",
        type=str,
        default=os.environ.get("SECOND_BRAIN_MEMORY_ROOT", "./runtime_data/Memory"),
        help="Root path for readable memory folder",
    )
    args = parser.parse_args()

    memory_path = Path(args.memory_root).resolve()
    memory_path.mkdir(parents=True, exist_ok=True)

    configure(memory_path / ".system" / "logs")
    handler = IPCHandler(str(memory_path))

    def sig_handler(sig, frame):
        handler.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    # Signal ready to Electron
    handler.send_event(
        "engine:ready",
        {
            "version": "1.0",
            "memory_root": str(memory_path),
            "pid": os.getpid(),
        },
    )

    # Slow network/capture work has a bounded queue, leaving pause/health responsive.
    pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix="model-worker")
    capacity = threading.BoundedSemaphore(2)

    def execute(req):
        try:
            emit(handler.handle_request(req))
        finally:
            capacity.release()

    slow = {
        "qa:ask",
        "model:test_connection",
        "model:test_neuraldeep",
        "capture:tick",
        "capture:analyze_screenshot",
    }
    try:
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                req = json.loads(line)
                if not isinstance(req, dict):
                    raise ValueError("Invalid request")
                if req.get("type") in slow:
                    if capacity.acquire(blocking=False):
                        pool.submit(execute, req)
                    else:
                        emit(
                            {
                                "request_id": req.get("request_id"),
                                "error": "BUSY: очередь заполнена",
                                "payload": None,
                            }
                        )
                else:
                    emit(handler.handle_request(req))
            except (ValueError, TypeError):
                emit(
                    {
                        "version": "1.0",
                        "request_id": "",
                        "type": "error",
                        "payload": None,
                        "error": "INVALID_REQUEST",
                    }
                )
    finally:
        pool.shutdown(wait=True, cancel_futures=True)
        handler.shutdown()


if __name__ == "__main__":
    main()
