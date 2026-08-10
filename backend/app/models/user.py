"""
User ORM model.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    # ── Identity ──────────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── Profile ───────────────────────────────────────────────────────────────
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Flags ────────────────────────────────────────────────────────────────
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ── Timestamps ────────────────────────────────────────────────────────────
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    documents: Mapped[list["Document"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Document", back_populates="user", cascade="all, delete-orphan"
    )
    chats: Mapped[list["ChatSession"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "ChatSession", back_populates="user", cascade="all, delete-orphan"
    )
    quizzes: Mapped[list["Quiz"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Quiz", back_populates="user", cascade="all, delete-orphan"
    )
    flashcard_sets: Mapped[list["FlashcardSet"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "FlashcardSet", back_populates="user", cascade="all, delete-orphan"
    )
    analytics: Mapped["UserAnalytics | None"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "UserAnalytics", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    study_sessions: Mapped[list["StudySession"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "StudySession", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"
