"""
UserAnalytics and StudySession ORM models.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserAnalytics(Base):
    __tablename__ = "user_analytics"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # ── Aggregate counters ────────────────────────────────────────────────────
    total_documents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_questions_asked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_quizzes_taken: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_flashcards_reviewed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_study_hours: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # ── Performance ───────────────────────────────────────────────────────────
    avg_quiz_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    streak_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Recency ───────────────────────────────────────────────────────────────
    last_active: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Study goals (Priority 7) ──────────────────────────────────────────────
    daily_goal_hours: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    weekly_goal_hours: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="analytics")  # type: ignore[name-defined]  # noqa: F821

    def __repr__(self) -> str:
        return f"<UserAnalytics user={self.user_id}>"


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # chat | quiz | flashcard | document | summary
    activity_type: Mapped[str] = mapped_column(String(32), nullable=False, default="document")

    session_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship("User", back_populates="study_sessions")  # type: ignore[name-defined]  # noqa: F821

    def __repr__(self) -> str:
        return f"<StudySession id={self.id} user={self.user_id} type={self.activity_type!r}>"
