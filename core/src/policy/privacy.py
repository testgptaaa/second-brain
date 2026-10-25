"""Text privacy and PII pseudonymization module (F05)."""
from __future__ import annotations

import os
import re
from typing import Dict, Tuple

PHONE_REGEX = re.compile(r"(\+7|8)[\s\-\(]*(\d{3})[\s\-\)]*(\d{3})[\s\-]*(\d{2})[\s\-]*(\d{2})")
EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
CARD_REGEX = re.compile(r"\b(?:\d[ -]*?){13,16}\b")


class TextPrivacyEngine:
    def __init__(self, mode: str = "raw"):
        self.mode = mode  # "raw" or "pseudonymize"
        self._mapping: Dict[str, str] = {}
        self.neuraldeep_endpoint = os.environ.get("NEURALDEEP_ENDPOINT", "")
        self.neuraldeep_key = os.environ.get("NEURALDEEP_API_KEY", "")

    def anonymize_text(self, text: str) -> Tuple[str, Dict[str, str]]:
        """Mask PII if privacy mode is 'pseudonymize'."""
        if self.mode != "pseudonymize" or not text:
            return text, {}

        masked = text
        local_map: Dict[str, str] = {}

        # 1. Emails
        for idx, match in enumerate(EMAIL_REGEX.finditer(text), 1):
            val = match.group(0)
            placeholder = f"[EMAIL_{idx}]"
            local_map[placeholder] = val
            masked = masked.replace(val, placeholder)

        # 2. Phones
        for idx, match in enumerate(PHONE_REGEX.finditer(text), 1):
            val = match.group(0)
            placeholder = f"[ТЕЛЕФОН_{idx}]"
            local_map[placeholder] = val
            masked = masked.replace(val, placeholder)

        return masked, local_map
