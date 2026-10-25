"""Data models for Memory documents, metadata, sources, and tasks."""
from __future__ import annotations

import hashlib
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DocumentType(str, Enum):
    EPISODE = "episode"
    CONTEXT = "context"
    NOTE = "note"
    TASK = "task"
    DAY_INDEX = "day_index"


class SourceType(str, Enum):
    BROWSER_TAB = "browser_tab"
    DESKTOP_WINDOW = "desktop_window"
    FILE = "file"
    CHAT = "chat"
    NOTE = "note"
    CALENDAR = "calendar"
    EXTERNAL_IMPORT = "external_import"


class CaptureMethod(str, Enum):
    DIRECT_TEXT = "direct_text"
    OCR = "ocr"
    FILE_READ = "file_read"
    MANUAL = "manual"
    CALENDAR_SYNC = "calendar_sync"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    WAITING_REPLY = "waiting_reply"
    DONE = "done"
    CANCELLED = "cancelled"


def compute_body_hash(body: str) -> str:
    """Compute deterministic SHA-256 hash of markdown body (excluding frontmatter).
    Spec requirement: Хеш считается по телу файла без YAML, чтобы служебные поля
    не создавали ложных изменений.
    """
    normalized = body.replace("\r\n", "\n").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class DocMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    title: str = ""
    doc_type: DocumentType = DocumentType.NOTE
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    revision: int = 1
    tags: List[str] = Field(default_factory=list)
    source_id: Optional[str] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class MemoryDocument(BaseModel):
    metadata: DocMetadata
    body: str
    relative_path: Optional[str] = None
    body_hash: Optional[str] = None

    def recalculate_hash(self) -> str:
        h = compute_body_hash(self.body)
        self.body_hash = h
        return h


class SourceRecord(BaseModel):
    id: str
    source_type: SourceType
    app_name: str
    window_title: str = ""
    uri: str = ""
    captured_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    method: CaptureMethod = CaptureMethod.DIRECT_TEXT
    coordinates: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ModelRequestRecord(BaseModel):
    id: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    mode: str = "text"  # "text" or "image"
    endpoint: str = ""
    model: str = ""
    payload_summary: Dict[str, Any] = Field(default_factory=dict)
    status: str = "success"  # "success" or "error"
    error_message: Optional[str] = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    response_summary: str = ""


class ConflictRecord(BaseModel):
    id: str
    doc_id: str
    canonical_path: str
    conflict_path: str
    metadata_path: str
    reason: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    base_revision: int
    base_hash: str
    human_hash: str
    app_hash: str
