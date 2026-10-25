"""Cross-platform active window and metadata adapter for macOS and Windows."""
from __future__ import annotations

import platform
import subprocess
import sys
from typing import Dict, Optional


class WindowTracker:
    def __init__(self):
        self.os_type = platform.system().lower()

    def get_active_window(self) -> Dict[str, str]:
        """Returns active application name, window title, and URL if available."""
        if self.os_type == "darwin":
            return self._get_macos_window()
        elif self.os_type == "windows":
            return self._get_windows_window()
        else:
            return {"app": "Desktop", "title": "Work Environment", "url": ""}

    def _get_macos_window(self) -> Dict[str, str]:
        script = """
        global frontApp, windowTitle
        set frontApp to ""
        set windowTitle to ""
        try
            tell application "System Events"
                set frontApp to name of first application process whose frontmost is true
                tell process frontApp
                    if exists (window 1) then
                        set windowTitle to name of window 1
                    end if
                end tell
            end tell
        end try
        return frontApp & ":::" & windowTitle
        """
        try:
            res = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                timeout=1.5,
            )
            out = res.stdout.strip()
            if ":::" in out:
                app, title = out.split(":::", 1)
                return {"app": app.strip(), "title": title.strip(), "url": ""}
        except Exception:
            pass
        return {"app": "Finder", "title": "Desktop", "url": ""}

    def _get_windows_window(self) -> Dict[str, str]:
        try:
            import ctypes
            user32 = ctypes.windll.user32
            h_wnd = user32.GetForegroundWindow()
            length = user32.GetWindowTextLengthW(h_wnd)
            buff = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(h_wnd, buff, length + 1)
            return {"app": "WindowsApp", "title": buff.value, "url": ""}
        except Exception:
            return {"app": "Explorer", "title": "Desktop", "url": ""}
