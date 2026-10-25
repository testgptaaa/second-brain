"""Markdown and Frontmatter parser/serializer complying with the project spec."""
from __future__ import annotations

import re
from typing import Any, Dict, Tuple
import yaml

from .models import DocMetadata, DocumentType, MemoryDocument, compute_body_hash

FRONTMATTER_REGEX = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse_markdown_with_frontmatter(text: str, default_id: str = "") -> MemoryDocument:
    """Parse text into MemoryDocument with frontmatter metadata and body.
    If frontmatter is missing, generates fallback metadata.
    Preserves all unrecognized YAML keys.
    """
    match = FRONTMATTER_REGEX.match(text)
    if match:
        raw_yaml = match.group(1)
        body = text[match.end():]
        try:
            parsed_yaml = yaml.safe_load(raw_yaml) or {}
            if not isinstance(parsed_yaml, dict):
                parsed_yaml = {"unparsed_yaml": raw_yaml}
        except Exception as e:
            parsed_yaml = {"yaml_error": str(e), "raw_yaml": raw_yaml}
    else:
        parsed_yaml = {}
        body = text

    # Extract known keys
    doc_id = str(parsed_yaml.pop("id", default_id))
    title = str(parsed_yaml.pop("title", ""))
    
    # Try inferring title from first markdown header if empty
    if not title:
        header_match = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        if header_match:
            title = header_match.group(1).strip()

    doc_type_raw = str(parsed_yaml.pop("doc_type", DocumentType.NOTE.value))
    try:
        doc_type = DocumentType(doc_type_raw)
    except ValueError:
        doc_type = DocumentType.NOTE

    created_at = parsed_yaml.pop("created_at", None)
    updated_at = parsed_yaml.pop("updated_at", None)
    revision = parsed_yaml.pop("revision", 1)
    tags = parsed_yaml.pop("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    source_id = parsed_yaml.pop("source_id", None)

    metadata_kwargs: Dict[str, Any] = {
        "id": doc_id,
        "title": title,
        "doc_type": doc_type,
        "revision": int(revision) if str(revision).isdigit() else 1,
        "tags": list(tags) if isinstance(tags, (list, tuple)) else [],
        "source_id": str(source_id) if source_id is not None else None,
        "extra": parsed_yaml,  # Preserves all extra unknown user fields
    }
    if created_at:
        metadata_kwargs["created_at"] = str(created_at)
    if updated_at:
        metadata_kwargs["updated_at"] = str(updated_at)

    metadata = DocMetadata(**metadata_kwargs)
    body_hash = compute_body_hash(body)

    return MemoryDocument(
        metadata=metadata,
        body=body,
        body_hash=body_hash,
    )


def serialize_markdown_document(doc: MemoryDocument) -> str:
    """Serialize MemoryDocument back to text with YAML frontmatter.
    Merges metadata and extra preserved fields.
    """
    frontmatter_dict: Dict[str, Any] = {
        "id": doc.metadata.id,
        "title": doc.metadata.title,
        "doc_type": doc.metadata.doc_type.value,
        "created_at": doc.metadata.created_at,
        "updated_at": doc.metadata.updated_at,
        "revision": doc.metadata.revision,
    }
    if doc.metadata.tags:
        frontmatter_dict["tags"] = doc.metadata.tags
    if doc.metadata.source_id:
        frontmatter_dict["source_id"] = doc.metadata.source_id

    # Add extra preserved fields
    if doc.metadata.extra:
        for k, v in doc.metadata.extra.items():
            if k not in frontmatter_dict:
                frontmatter_dict[k] = v

    yaml_str = yaml.dump(frontmatter_dict, allow_unicode=True, sort_keys=False).strip()
    clean_body = doc.body.lstrip("\r\n")

    return f"---\n{yaml_str}\n---\n\n{clean_body}\n"
