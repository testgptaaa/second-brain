"""Unit tests never write into a developer's OS credential store.
Actual macOS Keychain acceptance lives in desktop/tests/native-smoke.mjs.
"""

import pytest


@pytest.fixture(autouse=True)
def isolated_credentials(monkeypatch):
    values = {}

    class TestStore:
        backend = None
        error = None
        status = "isolated test credentials"

        def __init__(self, root):
            self.root = str(root)

        def get(self, name):
            return values.get((self.root, name), "")

        def put(self, name, value):
            values[self.root, name] = value

    monkeypatch.setattr("gateway.client.CredentialStore", TestStore)
