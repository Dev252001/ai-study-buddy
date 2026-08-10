"""
Document-related Pydantic schemas.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Core document ─────────────────────────────────────────────────────────────
class DocumentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    filename: str
    file_type: str
    file_size: int
    status: str
    processing_error: str | None
    page_count: int | None
    word_count: int | None
    char_count: int | None
    vector_collection_id: str | None
    subject: str | None
    tags: list[str] | None
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int


class DocumentCreateRequest(BaseModel):
    title: str | None = Field(None, max_length=512)
    subject: str | None = Field(None, max_length=255)
    description: str | None = None
    tags: list[str] | None = None


# ── Processing ────────────────────────────────────────────────────────────────
class ProcessingStatusResponse(BaseModel):
    document_id: uuid.UUID
    status: str
    processing_error: str | None
    page_count: int | None
    word_count: int | None


# ── Chunks ────────────────────────────────────────────────────────────────────
class DocumentChunkResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    chunk_index: int
    content: str
    page_number: int | None
    char_start: int | None
    char_end: int | None
    vector_id: str | None

    model_config = {"from_attributes": True}


# ── Search ────────────────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    document_ids: list[uuid.UUID] | None = None
    limit: int = Field(default=10, ge=1, le=50)
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class SearchResult(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    content: str
    score: float
    page_number: int | None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total: int
