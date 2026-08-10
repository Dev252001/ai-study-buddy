"""
Chat-related Pydantic schemas.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Citation ──────────────────────────────────────────────────────────────────
class Citation(BaseModel):
    document_id: uuid.UUID
    document_title: str
    chunk_content: str
    page_number: int | None
    score: float


# ── Sessions ──────────────────────────────────────────────────────────────────
class ChatSessionCreate(BaseModel):
    title: str | None = Field(None, max_length=512)
    document_ids: list[uuid.UUID] = Field(default_factory=list)


class ChatSessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str | None
    document_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionListResponse(BaseModel):
    items: list[ChatSessionResponse]
    total: int


# ── Messages ──────────────────────────────────────────────────────────────────
class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=10_000)
    session_id: uuid.UUID
    document_ids: list[uuid.UUID] | None = None


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    citations: list[Citation] | None
    tokens_used: int | None
    created_at: datetime
    suggested_questions: list[str] | None = None

    model_config = {"from_attributes": True}


# ── Chat request / response ───────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10_000)
    session_id: uuid.UUID | None = None
    document_ids: list[uuid.UUID] | None = None
    mode: Literal["rag", "general", "explain", "quiz_hint"] = "rag"


class ChatResponse(BaseModel):
    message: str
    citations: list[Citation]
    session_id: uuid.UUID
    tokens_used: int | None
    suggested_questions: list[str] = Field(default_factory=list)
