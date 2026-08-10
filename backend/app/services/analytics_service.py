"""
User analytics and study session tracking service.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
UTC = timezone.utc
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, PermissionException
from app.models.analytics import StudySession, UserAnalytics
from app.models.document import Document
from app.models.quiz import QuizAttempt
from app.schemas.analytics import (
    ProgressResponse,
    QuizScoreEntry,
    StudyGoalUpdate,
    StudySessionCreate,
    WeeklyHoursEntry,
)

logger = logging.getLogger(__name__)


class AnalyticsService:
    # ------------------------------------------------------------------
    # Analytics retrieval
    # ------------------------------------------------------------------
    async def get_user_analytics(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> UserAnalytics:
        result = await db.execute(
            select(UserAnalytics).where(UserAnalytics.user_id == str(user_id))
        )
        analytics = result.scalar_one_or_none()
        if not analytics:
            # Auto-create an analytics row if it doesn't exist yet
            analytics = UserAnalytics(user_id=str(user_id))
            db.add(analytics)
            await db.commit()
            await db.refresh(analytics)
        return analytics

    async def get_progress(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> ProgressResponse:
        analytics = await self.get_user_analytics(db, user_id)

        # ── Weekly hours: last 7 days ──────────────────────────────────────────
        today = date.today()
        week_start = today - timedelta(days=6)

        sessions_result = await db.execute(
            select(StudySession).where(
                StudySession.user_id == str(user_id),
                StudySession.started_at >= datetime.combine(week_start, datetime.min.time()).replace(tzinfo=UTC),
                StudySession.ended_at.is_not(None),
            )
        )
        sessions = list(sessions_result.scalars().all())

        # Aggregate minutes per day
        daily_minutes: dict[str, float] = {
            (today - timedelta(days=i)).isoformat(): 0.0 for i in range(6, -1, -1)
        }
        for session in sessions:
            day_key = session.started_at.date().isoformat()
            if day_key in daily_minutes:
                daily_minutes[day_key] += session.duration_minutes or 0

        weekly_hours = [
            WeeklyHoursEntry(date=day, hours=round(mins / 60, 2))
            for day, mins in daily_minutes.items()
        ]

        # ── Last 10 quiz attempt scores ───────────────────────────────────────
        attempts_result = await db.execute(
            select(QuizAttempt)
            .where(QuizAttempt.user_id == str(user_id))
            .order_by(QuizAttempt.completed_at.desc())
            .limit(10)
        )
        attempts = list(attempts_result.scalars().all())

        quiz_scores: list[QuizScoreEntry] = []
        for attempt in attempts:
            from sqlalchemy.orm import joinedload  # noqa: PLC0415
            from app.models.quiz import Quiz  # noqa: PLC0415

            quiz_result = await db.execute(
                select(Quiz).where(Quiz.id == attempt.quiz_id)
            )
            quiz = quiz_result.scalar_one_or_none()
            quiz_scores.append(
                QuizScoreEntry(
                    quiz_id=attempt.quiz_id,
                    title=quiz.title if quiz else "Unknown Quiz",
                    percentage=attempt.percentage,
                    completed_at=attempt.completed_at,
                )
            )

        # ── Documents count ───────────────────────────────────────────────────
        docs_result = await db.execute(
            select(func.count(Document.id)).where(Document.user_id == str(user_id))
        )
        documents_uploaded = docs_result.scalar_one() or 0

        return ProgressResponse(
            weekly_hours=weekly_hours,
            quiz_scores=quiz_scores,
            documents_uploaded=documents_uploaded,
            total_study_hours=analytics.total_study_hours,
            avg_quiz_score=analytics.avg_quiz_score,
            streak_days=analytics.streak_days,
            total_flashcards_reviewed=analytics.total_flashcards_reviewed,
            total_questions_asked=analytics.total_questions_asked,
        )

    # ------------------------------------------------------------------
    # Study sessions
    # ------------------------------------------------------------------
    async def start_study_session(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        data: StudySessionCreate,
    ) -> StudySession:
        session = StudySession(
            user_id=str(user_id),
            document_id=str(data.document_id) if data.document_id else None,
            activity_type=data.activity_type,
            session_metadata=data.session_metadata or {},
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        logger.info(
            "study_session_started",
            extra={"session_id": str(session.id), "user_id": str(user_id)},
        )
        return session

    async def end_study_session(
        self,
        db: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> StudySession:
        result = await db.execute(
            select(StudySession).where(StudySession.id == str(session_id))
        )
        session = result.scalar_one_or_none()
        if not session:
            raise NotFoundException("StudySession", str(session_id))
        if str(session.user_id) != str(user_id):
            raise PermissionException()
        if session.ended_at is not None:
            return session  # already ended — idempotent

        now = datetime.now(UTC)
        session.ended_at = now
        elapsed = now - session.started_at
        session.duration_minutes = max(1, int(elapsed.total_seconds() / 60))

        # Update total_study_hours in analytics
        analytics_result = await db.execute(
            select(UserAnalytics).where(UserAnalytics.user_id == str(user_id))
        )
        analytics = analytics_result.scalar_one_or_none()
        if analytics:
            analytics.total_study_hours = round(
                analytics.total_study_hours + session.duration_minutes / 60, 4
            )
            analytics.last_active = now

        await db.commit()
        await db.refresh(session)
        return session

    # ------------------------------------------------------------------
    # Generic activity logging
    # ------------------------------------------------------------------
    async def log_activity(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        activity_type: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Create a completed (zero-duration) session record for ad-hoc logging."""
        now = datetime.now(UTC)
        session = StudySession(
            user_id=str(user_id),
            activity_type=activity_type,
            session_metadata=metadata or {},
            started_at=now,
            ended_at=now,
            duration_minutes=0,
        )
        db.add(session)

        analytics_result = await db.execute(
            select(UserAnalytics).where(UserAnalytics.user_id == str(user_id))
        )
        analytics = analytics_result.scalar_one_or_none()
        if analytics:
            analytics.last_active = now

        await db.commit()

    # ------------------------------------------------------------------
    # Study goals
    # ------------------------------------------------------------------
    async def update_study_goals(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        data: StudyGoalUpdate,
    ) -> UserAnalytics:
        analytics = await self.get_user_analytics(db, user_id)
        if data.daily_goal_hours is not None:
            analytics.daily_goal_hours = data.daily_goal_hours
        if data.weekly_goal_hours is not None:
            analytics.weekly_goal_hours = data.weekly_goal_hours
        await db.commit()
        await db.refresh(analytics)
        return analytics

    # ------------------------------------------------------------------
    # Streak management
    # ------------------------------------------------------------------
    async def update_streak(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        analytics = await self.get_user_analytics(db, user_id)
        now = datetime.now(UTC)
        today = now.date()

        if analytics.last_active is None:
            analytics.streak_days = 1
        else:
            last_day = analytics.last_active.date()
            delta = (today - last_day).days
            if delta == 0:
                pass  # Same day — streak unchanged
            elif delta == 1:
                analytics.streak_days += 1
            else:
                analytics.streak_days = 1  # Streak broken

        analytics.last_active = now
        await db.commit()
