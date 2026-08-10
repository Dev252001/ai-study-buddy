"""
Quiz-related Pydantic schemas.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Generation request ────────────────────────────────────────────────────────
class QuizGenerateRequest(BaseModel):
    document_id: uuid.UUID
    quiz_type: Literal["mcq", "true_false", "fill_blank", "short_answer", "long_answer"] = "mcq"
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    num_questions: int = Field(default=10, ge=1, le=50)
    topics: list[str] | None = None
    title: str | None = Field(None, max_length=512)


# ── Question ──────────────────────────────────────────────────────────────────
class QuizQuestionResponse(BaseModel):
    id: uuid.UUID
    question_text: str
    question_type: str
    options: list[str] | None
    order_index: int
    # correct_answer and explanation are omitted here and returned only in
    # the attempt-result response to prevent cheating.

    model_config = {"from_attributes": True}


class QuizQuestionWithAnswerResponse(QuizQuestionResponse):
    """Extended version returned after an attempt is submitted."""
    correct_answer: str
    explanation: str | None
    is_correct: bool = False
    user_answer: str = ""


# ── Quiz ──────────────────────────────────────────────────────────────────────
class QuizResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    document_id: uuid.UUID | None
    title: str
    quiz_type: str
    difficulty: str
    total_questions: int
    created_at: datetime
    questions: list[QuizQuestionResponse]

    model_config = {"from_attributes": True}


class QuizListResponse(BaseModel):
    items: list[QuizResponse]
    total: int


# ── Attempt ───────────────────────────────────────────────────────────────────
class QuizAttemptRequest(BaseModel):
    quiz_id: uuid.UUID
    answers: dict[str, str]  # question_id -> answer text / option
    time_taken_seconds: int | None = None


class QuizAttemptResponse(BaseModel):
    attempt_id: uuid.UUID
    quiz_id: uuid.UUID
    score: float
    max_score: float
    percentage: float
    correct: int
    incorrect: int
    time_taken_seconds: int | None
    completed_at: datetime
    feedback: list[QuizQuestionWithAnswerResponse]

    model_config = {"from_attributes": True}
