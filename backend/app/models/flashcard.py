"""
FlashcardSet and Flashcard ORM models.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")

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
    user: Mapped["User"] = relationship("User", back_populates="flashcard_sets")  # type: ignore[name-defined]  # noqa: F821
    cards: Mapped[list["Flashcard"]] = relationship(
        "Flashcard", back_populates="flashcard_set", cascade="all, delete-orphan", order_by="Flashcard.order_index"
    )

    def __repr__(self) -> str:
        return f"<FlashcardSet id={self.id} title={self.title!r}>"


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    set_id: Mapped[uuid.UUID] = mapped_column(
        String(36),
        ForeignKey("flashcard_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    front: Mapped[str] = mapped_column(Text, nullable=False)   # question / prompt
    back: Mapped[str] = mapped_column(Text, nullable=False)    # answer
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Spaced-repetition stats ───────────────────────────────────────────────
    times_reviewed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    times_correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_reviewed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    flashcard_set: Mapped["FlashcardSet"] = relationship("FlashcardSet", back_populates="cards")

    def __repr__(self) -> str:
        return f"<Flashcard id={self.id} idx={self.order_index}>"
