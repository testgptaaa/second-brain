"""Screen capture and native OCR adapter for macOS."""
from __future__ import annotations

import os
import platform
import subprocess
from pathlib import Path
from typing import Optional


class ScreenCapturer:
    def __init__(self, ocr_binary_path: Optional[Path] = None):
        self.os_type = platform.system().lower()
        if ocr_binary_path and ocr_binary_path.exists():
            self.ocr_binary = ocr_binary_path
        else:
            # Look in core/bin/macos_ocr relative to this file
            default_bin = Path(__file__).parent.parent.parent / "bin" / "macos_ocr"
            self.ocr_binary = default_bin if default_bin.exists() else None

    def capture_screen(self, output_path: Path) -> bool:
        """Silently capture main display to PNG file."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if self.os_type == "darwin":
            try:
                cmd = ["screencapture", "-x", "-m", "-t", "png", str(output_path.resolve())]
                res = subprocess.run(cmd, capture_output=True, timeout=3.0)
                return output_path.exists() and output_path.stat().st_size > 0
            except Exception:
                return False
        return False

    def run_ocr(self, image_path: Path) -> str:
        """Extract text from screenshot using native Apple Vision OCR."""
        if not image_path.exists():
            return ""

        if self.ocr_binary and self.ocr_binary.exists():
            try:
                res = subprocess.run(
                    [str(self.ocr_binary.resolve()), str(image_path.resolve())],
                    capture_output=True,
                    text=True,
                    timeout=5.0,
                )
                return res.stdout.strip()
            except Exception:
                pass
        return ""
