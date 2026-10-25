"""Credentials never enter new SQLite settings. macOS uses its native Keychain.
Other platforms retain supplied credentials in process memory only.
"""

import hashlib
import sys


class CredentialStore:
    def __init__(self, root):
        self.service = (
            "second-brain." + hashlib.sha256(str(root).encode()).hexdigest()[:20]
        )
        self.backend = None
        self.error = None
        self.memory = {}
        if sys.platform == "darwin":
            try:
                from keyring.backends.macOS import Keyring

                self.backend = Keyring()
            except Exception:
                self.error = "Keychain недоступен"

    @property
    def status(self):
        return self.error or (
            "macOS Keychain"
            if self.backend
            else "Только память процесса — требуется macOS для сохранения ключей"
        )

    def get(self, name):
        if self.backend:
            try:
                value = self.backend.get_password(self.service, name) or ""
                self.error = None
                return value
            except Exception:
                self.error = "Keychain недоступен"
                return ""
        return self.memory.get(name, "")

    def put(self, name, value):
        if self.error and not self.backend:
            raise RuntimeError(self.error)
        if self.backend:
            try:
                if value:
                    self.backend.set_password(self.service, name, value)
                    if self.backend.get_password(self.service, name) != value:
                        raise RuntimeError("Keychain verification failed")
                elif self.backend.get_password(self.service, name):
                    self.backend.delete_password(self.service, name)
                self.error = None
            except Exception:
                self.error = "Не удалось обновить Keychain"
                raise RuntimeError(self.error) from None
        else:
            self.memory[name] = value
