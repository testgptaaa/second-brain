"""Cross-platform active window, browser tab URL, and idle time tracker for macOS."""
from __future__ import annotations

import platform
import subprocess
import sys
from typing import Dict, Optional


class WindowTracker:
    def __init__(self):
        self.os_type = platform.system().lower()

    def get_idle_seconds(self) -> float:
        """Returns number of seconds since last user input (mouse/keyboard)."""
        if self.os_type == "darwin":
            try:
                cmd = "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}'"
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=1.0)
                val = res.stdout.strip()
                if val.isdigit():
                    return float(val)
            except Exception:
                pass
        return 0.0

    def get_active_window(self) -> Dict[str, str]:
        """Returns active application name, window title, and active tab URL (if browser)."""
        if self.os_type == "darwin":
            return self._get_macos_window()
        elif self.os_type == "windows":
            return self._get_windows_window()
        else:
            return {"app": "Desktop", "title": "Work Environment", "url": ""}

    def _get_macos_window(self) -> Dict[str, str]:
        # AppleScript to get frontmost process, window title, and browser URL if applicable
        script = """
        global frontApp, windowTitle, tabUrl
        set frontApp to ""
        set windowTitle to ""
        set tabUrl to ""

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

        try
            if frontApp is "Google Chrome" or frontApp is "Brave Browser" or frontApp is "Chromium" then
                tell application frontApp
                    set tabUrl to URL of active tab of front window
                end tell
            else if frontApp is "Safari" then
                tell application "Safari"
                    set tabUrl to URL of front document
                end tell
            else if frontApp is "Yandex" then
                tell application "Yandex"
                    set tabUrl to URL of active tab of front window
                end tell
            end if
        end try

        return frontApp & ":::" & windowTitle & ":::" & tabUrl
        """
        try:
            res = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                timeout=1.8,
            )
            out = res.stdout.strip()
            if ":::" in out:
                parts = out.split(":::", 2)
                app = parts[0].strip() if len(parts) > 0 else ""
                title = parts[1].strip() if len(parts) > 1 else ""
                url = parts[2].strip() if len(parts) > 2 else ""
                return {"app": app, "title": title, "url": url}
        except Exception:
            pass

        return {"app": "Finder", "title": "Рабочий стол", "url": ""}

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
