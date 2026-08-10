"""
Analytics-related Pydantic schemas.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── User analytics ────────────────────────────────────────────────────────────
class AnalyticsResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    total_documents: int
    total_questions_asked: int
    total_quizzes_taken: int
    total_flashcards_reviewed: int
    total_study_hours: float
    avg_quiz_score: float
    streak_days: int
    last_active: datetime | None
    updated_at: datetime
    daily_goal_hours: float = 2.0
    weekly_goal_hours: float = 10.0

    model_config = {"from_attributes": True}


# ── Goal update ───────────────────────────────────────────────────────────────
class StudyGoalUpdate(BaseModel):
    daily_goal_hours: float | None = None
    weekly_goal_hours: float | None = None


# ── Study sessions ────────────────────────────────────────────────────────────
class StudySessionCreate(BaseModel):
    activity_type: Literal["chat", "quiz", "flashcard", "document", "summary"] = "document"
    document_id: uuid.UUID | None = None
    session_metadata: dict | None = None


class StudySessionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    document_id: uuid.UUID | None
    started_at: datetime
    ended_at: datetime | None
    duration_minutes: int | None
    activity_type: str
    session_metadata: dict | None

    model_config = {"from_attributes": True}


# ── Progress dashboard ────────────────────────────────────────────────────────
class WeeklyHoursEntry(BaseModel):
    date: str   # ISO date string  e.g. "2024-06-10"
    hours: float


class QuizScoreEntry(BaseModel):
    quiz_id: uuid.UUID
    title: str
    percentage: float
    completed_at: datetime


class ProgressResponse(BaseModel):
    weekly_hours: list[WeeklyHoursEntry]
    quiz_scores: list[QuizScoreEntry]
    documents_uploaded: int
    total_study_hours: float
    avg_quiz_score: float
    streak_days: int
    total_flashcards_reviewed: int
    total_questions_asked: int
