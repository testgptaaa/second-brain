"""Main entrypoint for second-brain-core Python process."""
from __future__ import annotations

import argparse
import json
import os
import signal
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add core/src to sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

# Load .env file from project root or current working dir
load_dotenv(Path(__file__).parent.parent.parent / ".env")
load_dotenv()

from ipc.handler import IPCHandler


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

    handler = IPCHandler(str(memory_path))

    def sig_handler(sig, frame):
        handler.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, sig_handler)
    signal.signal(signal.SIGTERM, sig_handler)

    # Signal ready to Electron
    handler.send_event("engine:ready", {
        "version": "1.0",
        "memory_root": str(memory_path),
        "pid": os.getpid(),
    })

    # Read lines from stdin
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
                response = handler.handle_request(req)
                sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
                sys.stdout.flush()
            except Exception as e:
                err_resp = {
                    "version": "1.0",
                    "request_id": "",
                    "type": "error",
                    "payload": None,
                    "error": f"Failed to parse or process request: {str(e)}",
                }
                sys.stdout.write(json.dumps(err_resp, ensure_ascii=False) + "\n")
                sys.stdout.flush()
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        handler.shutdown()


if __name__ == "__main__":
    main()
