"""One writer lock for responses and watcher events."""

import json
import sys
import threading

_lock = threading.Lock()


def emit(message):
    with _lock:
        sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
        sys.stdout.flush()
