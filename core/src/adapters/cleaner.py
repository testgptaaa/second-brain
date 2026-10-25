"""Temporary screenshots retention and manual cleanup manager (F06)."""
from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Dict, Optional


def clean_temporary_screenshots(
    memory_root: Path,
    max_age_days: Optional[int] = None,
) -> Dict[str, float]:
    """Delete temporary screenshots from attachments folders.
    If max_age_days is None: deletes all screenshots (manual user cleanup).
    If max_age_days is provided: deletes screenshots older than specified days.
    F06 requirement: «Очистить снимки» удаляет временные изображения, оставляя текст и заметки.
    """
    days_dir = memory_root / "days"
    if not days_dir.exists():
        return {"deleted_count": 0, "freed_bytes": 0, "freed_mb": 0.0}

    now = time.time()
    deleted_count = 0
    freed_bytes = 0

    for shot_path in days_dir.rglob("attachments/*.png"):
        try:
            stat = shot_path.stat()
            age_days = (now - stat.st_mtime) / 86400.0

            should_delete = False
            if max_age_days is None:
                should_delete = True
            elif age_days > max_age_days:
                should_delete = True

            if should_delete:
                freed_bytes += stat.st_size
                shot_path.unlink()
                deleted_count += 1
        except Exception:
            continue

    return {
        "deleted_count": deleted_count,
        "freed_bytes": freed_bytes,
        "freed_mb": round(freed_bytes / (1024 * 1024), 2),
    }
