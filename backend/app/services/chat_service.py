"""
Chat session and message management service.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
UTC = timezone.utc
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, PermissionException
from app.models.analytics import StudySession, UserAnalytics
from app.models.chat import ChatMessage, ChatSession
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSessionCreate,
    Citation,
)

logger = logging.getLogger(__name__)


class ChatService:
    # ------------------------------------------------------------------
    # Session management
    # ------------------------------------------------------------------
    async def create_session(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        data: ChatSessionCreate,
    ) -> ChatSession:
        session = ChatSession(
            user_id=str(user_id),
            title=data.title,
            document_ids=[str(d) for d in data.document_ids],
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        logger.info("chat_session_created", extra={"session_id": str(session.id)})
        return session

    async def get_session(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> ChatSession:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == str(session_id))
        )
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundException("ChatSession", str(session_id))
        if str(session.user_id) != str(user_id):
            raise PermissionException()
        return session

    async def list_sessions(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[ChatSession]:
        result = await db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == str(user_id))
            .order_by(ChatSession.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def delete_session(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        session = await self.get_session(db, session_id, user_id)
        await db.delete(session)
        await db.commit()

    # ------------------------------------------------------------------
    # Messages
    # ------------------------------------------------------------------
    async def get_messages(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> list[ChatMessage]:
        await self.get_session(db, session_id, user_id)  # ownership check
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == str(session_id))
            .order_by(ChatMessage.created_at.asc())
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Core send_message pipeline
    # ------------------------------------------------------------------
    async def send_message(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: ChatRequest,
        rag_service,  # RAGService – typed loosely to avoid circular import
    ) -> ChatResponse:
        """
        1. Resolve or create chat session.
        2. Persist user message.
        3. Retrieve recent history (last 10 messages).
        4. Call RAG pipeline.
        5. Persist assistant reply with citations.
        6. Update analytics.
        7. Return ChatResponse.
        """

        # ── 1. Resolve session ────────────────────────────────────────────────
        if request.session_id:
            session = await self.get_session(db, request.session_id, user_id)
            # Merge any extra document_ids from the request into the session
            if request.document_ids:
                existing_ids = set(session.document_ids)
                new_ids = {str(d) for d in request.document_ids}
                merged = list(existing_ids | new_ids)
                if merged != session.document_ids:
                    session.document_ids = merged
                    await db.flush()
        else:
            # Auto-create a session titled with the first 80 chars of the message
            auto_title = request.message[:80] + ("…" if len(request.message) > 80 else "")
            session = ChatSession(
                user_id=str(user_id),
                title=auto_title,
                document_ids=[str(d) for d in (request.document_ids or [])],
            )
            db.add(session)
            await db.flush()

        # ── 2. Persist user message ──────────────────────────────────────────
        user_msg = ChatMessage(
            session_id=session.id,
            role="user",
            content=request.message,
        )
        db.add(user_msg)
        await db.flush()

        # ── 3. Retrieve recent history ───────────────────────────────────────
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(21)  # 10 pairs + current
        )
        all_recent = list(reversed(history_result.scalars().all()))
        # Exclude the message we just inserted
        history_msgs = [m for m in all_recent if m.id != user_msg.id][-20:]
        chat_history = [{"role": m.role, "content": m.content} for m in history_msgs]

        # ── 4. RAG pipeline ──────────────────────────────────────────────────
        doc_id_strings: list[str] = [str(d) for d in (request.document_ids or [])]
        if not doc_id_strings and session.document_ids:
            doc_id_strings = session.document_ids

        try:
            answer, citations = await rag_service.answer_with_rag(
                query=request.message,
                document_ids=doc_id_strings or None,
                chat_history=chat_history,
                mode=request.mode,
            )
        except Exception as exc:
            logger.error("rag_pipeline_failed", extra={"error": str(exc)})
            answer = "I'm sorry, I encountered an error processing your request. Please try again."
            citations = []

        # ── 5. Generate follow-up suggestions ────────────────────────────────
        suggested_questions: list[str] = []
        try:
            from app.core.deps import get_llm_service  # noqa: PLC0415
            llm = get_llm_service()
            suggestion_prompt = (
                f"Based on this question: \"{request.message}\"\n"
                f"And this answer: \"{answer[:500]}\"\n\n"
                "Generate exactly 3 concise follow-up questions a student might ask next. "
                "Return ONLY the 3 questions, one per line, without numbering or bullet points."
            )
            raw = await llm.generate(suggestion_prompt, system_prompt="You are a helpful study assistant.")
            lines = [line.strip() for line in raw.strip().splitlines() if line.strip()]
            suggested_questions = lines[:3]
        except Exception:
            pass  # suggestions are best-effort

        # ── 6. Persist assistant message ─────────────────────────────────────
        citations_data = [c.model_dump(mode="json") for c in citations]
        assistant_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content=answer,
            citations=citations_data,
            suggested_questions=suggested_questions or None,
        )
        db.add(assistant_msg)

        # Update session updated_at
        session.updated_at = datetime.now(UTC)
        await db.commit()
        await db.refresh(session)

        # ── 7. Update analytics + streak ─────────────────────────────────────
        await self._update_analytics(db, user_id)
        from app.services.analytics_service import AnalyticsService  # noqa: PLC0415
        await AnalyticsService().update_streak(db, user_id)

        # ── 8. Return response ───────────────────────────────────────────────
        return ChatResponse(
            message=answer,
            citations=citations,
            session_id=session.id,
            tokens_used=None,
            suggested_questions=suggested_questions,
        )

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------
    async def _update_analytics(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        result = await db.execute(
            select(UserAnalytics).where(UserAnalytics.user_id == str(user_id))
        )
        analytics = result.scalar_one_or_none()
        if analytics:
            analytics.total_questions_asked += 1
            # Credit 2 minutes per chat message as study time
            analytics.total_study_hours = round(analytics.total_study_hours + 2 / 60, 4)
            now = datetime.now(UTC)
            analytics.last_active = now
            db.add(StudySession(
                user_id=str(user_id),
                activity_type="chat",
                started_at=now,
                ended_at=now,
                duration_minutes=2,
            ))
            await db.commit()
