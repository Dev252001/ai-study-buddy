"""
Flashcard-related Pydantic schemas.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Generation request ────────────────────────────────────────────────────────
class FlashcardSetGenerateRequest(BaseModel):
    document_id: uuid.UUID
    num_cards: int = Field(default=20, ge=1, le=100)
    topic: str | None = Field(None, max_length=255)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    title: str | None = Field(None, max_length=512)


# ── Single card ───────────────────────────────────────────────────────────────
class FlashcardResponse(BaseModel):
    id: uuid.UUID
    set_id: uuid.UUID
    front: str
    back: str
    hint: str | None
    topic: str | None
    difficulty: str
    order_index: int
    times_reviewed: int
    times_correct: int
    last_reviewed: datetime | None

    model_config = {"from_attributes": True}


# ── Set ───────────────────────────────────────────────────────────────────────
class FlashcardSetResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    document_id: uuid.UUID | None
    title: str
    description: str | None
    topic: str | None
    difficulty: str
    created_at: datetime
    updated_at: datetime
    cards: list[FlashcardResponse]

    model_config = {"from_attributes": True}


class FlashcardSetListResponse(BaseModel):
    items: list[FlashcardSetResponse]
    total: int


# ── Review ────────────────────────────────────────────────────────────────────
class FlashcardReviewRequest(BaseModel):
    flashcard_id: uuid.UUID
    was_correct: bool
