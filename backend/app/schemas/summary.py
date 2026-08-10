"""
Summary and concept-explanation Pydantic schemas.
"""
from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


# ── Summary ───────────────────────────────────────────────────────────────────
class SummaryRequest(BaseModel):
    document_id: uuid.UUID
    summary_type: Literal["short", "detailed", "bullet", "one_page", "exam_revision"] = "detailed"
    max_words: int | None = Field(None, ge=50, le=5000)


class SummaryResponse(BaseModel):
    document_id: uuid.UUID
    summary_type: str
    summary: str
    key_points: list[str]
    word_count: int


# ── Concept explanation ───────────────────────────────────────────────────────
class ConceptExplainRequest(BaseModel):
    concept: str = Field(..., min_length=1, max_length=512)
    document_id: uuid.UUID | None = None
    level: Literal["beginner", "school", "college", "advanced"] = "college"
    use_analogies: bool = True
    use_examples: bool = True


class ConceptExplainResponse(BaseModel):
    concept: str
    explanation: str
    analogies: list[str]
    analogy: str | None = None  # convenience alias: first element of analogies
    examples: list[str]
    related_concepts: list[str]
    level: str
