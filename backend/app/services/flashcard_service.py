"""
Flashcard set generation and review service.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
UTC = timezone.utc
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AIServiceException, NotFoundException, PermissionException
from app.models.analytics import StudySession, UserAnalytics
from app.models.flashcard import Flashcard, FlashcardSet
from app.schemas.flashcard import FlashcardReviewRequest, FlashcardSetGenerateRequest

logger = logging.getLogger(__name__)

_FC_SYSTEM_PROMPT = (
    "You are an expert educator who creates effective flashcards for studying. "
    "You always respond with valid JSON only — no markdown fences, no prose."
)

_FC_PROMPT_TEMPLATE = """
Create exactly {num_cards} flashcards from the provided study material.

Requirements:
- Difficulty: {difficulty}
{topic_hint}

For each flashcard return a JSON object with these exact keys:
  "front"      : the question or prompt (concise, clear)
  "back"       : the answer or explanation (thorough but focused)
  "hint"       : an optional hint to help recall (or null)
  "topic"      : the sub-topic this card covers (short label or null)
  "difficulty" : one of "easy", "medium", or "hard"

Return a JSON array of exactly {num_cards} such objects and nothing else.

Study material:
{context}
"""


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    """Robustly extract the first JSON array from LLM output."""
    text = re.sub(r"```(?:json)?", "", text).strip()
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass
    return []


class FlashcardService:
    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------
    async def generate_flashcards(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: FlashcardSetGenerateRequest,
        rag_service,
    ) -> FlashcardSet:
        query = f"key concepts definitions {request.topic or ''}"
        chunks = await rag_service.retrieve(
            query=query,
            document_ids=[str(request.document_id)],
            n_results=12,
        )
        if not chunks:
            raise AIServiceException("No content found in the specified document.")

        context = "\n\n".join(c.content for c in chunks[:10])
        topic_hint = f"- Focus on the topic: {request.topic}" if request.topic else ""

        prompt = _FC_PROMPT_TEMPLATE.format(
            num_cards=request.num_cards,
            difficulty=request.difficulty,
            topic_hint=topic_hint,
            context=context,
        )

        raw = await rag_service._llm.generate(
            prompt=prompt,
            system_prompt=_FC_SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.4,
        )

        cards_data = _extract_json_array(raw)
        if not cards_data:
            logger.error("flashcard_json_parse_failed", extra={"raw": raw[:500]})
            raise AIServiceException("LLM returned an unparseable flashcard response.")

        title = (
            request.title
            or f"Flashcard Set — {chunks[0].document_title}"
            + (f" ({request.topic})" if request.topic else "")
        )

        fc_set = FlashcardSet(
            user_id=str(user_id),
            document_id=str(request.document_id),
            title=title,
            topic=request.topic,
            difficulty=request.difficulty,
        )
        db.add(fc_set)
        await db.flush()

        for idx, card_data in enumerate(cards_data):
            card = Flashcard(
                set_id=fc_set.id,
                front=str(card_data.get("front", "")),
                back=str(card_data.get("back", "")),
                hint=card_data.get("hint"),
                topic=card_data.get("topic"),
                difficulty=str(card_data.get("difficulty", request.difficulty)),
                order_index=idx,
            )
            db.add(card)

        await db.commit()
        await db.refresh(fc_set)

        result = await db.execute(
            select(FlashcardSet)
            .options(selectinload(FlashcardSet.cards))
            .where(FlashcardSet.id == fc_set.id)
        )
        return result.scalar_one()

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    async def get_set(
        self, db: AsyncSession, set_id: uuid.UUID, user_id: uuid.UUID
    ) -> FlashcardSet:
        result = await db.execute(
            select(FlashcardSet)
            .options(selectinload(FlashcardSet.cards))
            .where(FlashcardSet.id == str(set_id))
        )
        fc_set = result.scalar_one_or_none()
        if not fc_set:
            raise NotFoundException("FlashcardSet", str(set_id))
        if str(fc_set.user_id) != str(user_id):
            raise PermissionException()
        return fc_set

    async def list_sets(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> list[FlashcardSet]:
        result = await db.execute(
            select(FlashcardSet)
            .options(selectinload(FlashcardSet.cards))
            .where(FlashcardSet.user_id == str(user_id))
            .order_by(FlashcardSet.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def delete_set(
        self, db: AsyncSession, set_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        fc_set = await self.get_set(db, set_id, user_id)
        await db.delete(fc_set)
        await db.commit()

    async def get_cards(
        self, db: AsyncSession, set_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[Flashcard]:
        fc_set = await self.get_set(db, set_id, user_id)
        return list(fc_set.cards)

    # ------------------------------------------------------------------
    # Review
    # ------------------------------------------------------------------
    async def review_card(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: FlashcardReviewRequest,
    ) -> None:
        result = await db.execute(
            select(Flashcard).where(Flashcard.id == str(request.flashcard_id))
        )
        card = result.scalar_one_or_none()
        if not card:
            raise NotFoundException("Flashcard", str(request.flashcard_id))

        # Verify ownership via set
        set_result = await db.execute(
            select(FlashcardSet).where(FlashcardSet.id == card.set_id)
        )
        fc_set = set_result.scalar_one_or_none()
        if not fc_set or str(fc_set.user_id) != str(user_id):
            raise PermissionException()

        card.times_reviewed += 1
        if request.was_correct:
            card.times_correct += 1
        card.last_reviewed = datetime.now(UTC)

        # Update aggregate analytics
        analytics_result = await db.execute(
            select(UserAnalytics).where(UserAnalytics.user_id == str(user_id))
        )
        analytics = analytics_result.scalar_one_or_none()
        if analytics:
            analytics.total_flashcards_reviewed += 1
            # Credit 1 minute per flashcard review as study time
            analytics.total_study_hours = round(analytics.total_study_hours + 1 / 60, 4)
            now = datetime.now(UTC)
            analytics.last_active = now
            db.add(StudySession(
                user_id=str(user_id),
                activity_type="flashcard",
                started_at=now,
                ended_at=now,
                duration_minutes=1,
            ))

        await db.commit()
