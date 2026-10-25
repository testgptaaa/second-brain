"""Policy Engine for observation control, exclusions, privacy modes, and pause states."""
from __future__ import annotations

import json
from typing import List, Set
from urllib.parse import urlparse

from index.indexer import Indexer

DEFAULT_EXCLUDED_APPS = [
    "1Password",
    "KeePass",
    "Bitwarden",
    "Keychain Access",
    "Сбербанк",
    "Тинькофф",
    "Альфа-Банк",
]

DEFAULT_EXCLUDED_DOMAINS = [
    "accounts.google.com",
    "login.microsoftonline.com",
    "sberbank.ru",
    "tbank.ru",
    "alfabank.ru",
    "gosuslugi.ru",
    "passwords.google.com",
]


class PolicyEngine:
    def __init__(self, indexer: Indexer):
        self.indexer = indexer
        self._load_policy()

    def _load_policy(self) -> None:
        # Load pause state
        paused_val = self.indexer.get_setting("policy_is_paused", "false")
        self.is_paused = (paused_val.lower() == "true")

        # Load excluded apps
        apps_json = self.indexer.get_setting("policy_excluded_apps")
        if apps_json:
            try:
                self.excluded_apps: Set[str] = set(json.loads(apps_json))
            except Exception:
                self.excluded_apps = set(DEFAULT_EXCLUDED_APPS)
        else:
            self.excluded_apps = set(DEFAULT_EXCLUDED_APPS)

        # Load excluded domains
        domains_json = self.indexer.get_setting("policy_excluded_domains")
        if domains_json:
            try:
                self.excluded_domains: Set[str] = set(json.loads(domains_json))
            except Exception:
                self.excluded_domains = set(DEFAULT_EXCLUDED_DOMAINS)
        else:
            self.excluded_domains = set(DEFAULT_EXCLUDED_DOMAINS)

        # Privacy mode: "raw" (no masking) or "pseudonymize"
        self.privacy_mode = self.indexer.get_setting("policy_privacy_mode", "raw")

        # Analysis mode: "direct_text" or "image_vision"
        self.analysis_mode = self.indexer.get_setting("policy_analysis_mode", "direct_text")

    def set_paused(self, paused: bool) -> None:
        self.is_paused = paused
        self.indexer.set_setting("policy_is_paused", "true" if paused else "false")

    def is_app_allowed(self, app_name: str) -> bool:
        if self.is_paused:
            return False
        clean_app = app_name.strip().lower()
        for excluded in self.excluded_apps:
            if excluded.strip().lower() in clean_app:
                return False
        return True

    def is_url_allowed(self, url: str) -> bool:
        if self.is_paused:
            return False
        if not url:
            return True
        try:
            parsed = urlparse(url)
            hostname = (parsed.hostname or "").lower()
            for excluded in self.excluded_domains:
                clean_excluded = excluded.strip().lower()
                if hostname == clean_excluded or hostname.endswith("." + clean_excluded):
                    return False
        except Exception:
            return False
        return True

    def add_excluded_app(self, app_name: str) -> None:
        self.excluded_apps.add(app_name.strip())
        self._persist_apps()

    def remove_excluded_app(self, app_name: str) -> None:
        self.excluded_apps.discard(app_name.strip())
        self._persist_apps()

    def add_excluded_domain(self, domain: str) -> None:
        self.excluded_domains.add(domain.strip())
        self._persist_domains()

    def remove_excluded_domain(self, domain: str) -> None:
        self.excluded_domains.discard(domain.strip())
        self._persist_domains()

    def set_privacy_mode(self, mode: str) -> None:
        if mode in ("raw", "pseudonymize"):
            self.privacy_mode = mode
            self.indexer.set_setting("policy_privacy_mode", mode)

    def set_analysis_mode(self, mode: str) -> None:
        if mode in ("direct_text", "image_vision"):
            self.analysis_mode = mode
            self.indexer.set_setting("policy_analysis_mode", mode)

    def _persist_apps(self) -> None:
        self.indexer.set_setting("policy_excluded_apps", json.dumps(list(self.excluded_apps)))

    def _persist_domains(self) -> None:
        self.indexer.set_setting("policy_excluded_domains", json.dumps(list(self.excluded_domains)))

    def get_status_dict(self) -> dict:
        return {
            "is_paused": self.is_paused,
            "privacy_mode": self.privacy_mode,
            "analysis_mode": self.analysis_mode,
            "excluded_apps": sorted(list(self.excluded_apps)),
            "excluded_domains": sorted(list(self.excluded_domains)),
        }
