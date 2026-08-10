"""
Analytics router — /api/v1/analytics
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsResponse,
    ProgressResponse,
    StudyGoalUpdate,
    StudySessionCreate,
    StudySessionResponse,
)
from app.services.analytics_service import AnalyticsService

router = APIRouter()
_analytics_service = AnalyticsService()


# ── User analytics overview ───────────────────────────────────────────────────
@router.get("/", response_model=AnalyticsResponse)
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> AnalyticsResponse:
    """Return aggregate analytics for the current user."""
    analytics = await _analytics_service.get_user_analytics(db, current_user.id)
    return AnalyticsResponse.model_validate(analytics)


# ── Progress dashboard ────────────────────────────────────────────────────────
@router.get("/progress", response_model=ProgressResponse)
async def get_progress(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ProgressResponse:
    """Return detailed progress metrics: weekly hours, quiz scores, streaks, etc."""
    return await _analytics_service.get_progress(db, current_user.id)


# ── Start study session ───────────────────────────────────────────────────────
@router.post("/session/start", response_model=StudySessionResponse, status_code=201)
async def start_session(
    data: StudySessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StudySessionResponse:
    """Start a new study session and return the session record."""
    session = await _analytics_service.start_study_session(db, current_user.id, data)
    return StudySessionResponse.model_validate(session)


# ── End study session ─────────────────────────────────────────────────────────
# ── Update study goals ────────────────────────────────────────────────────────
@router.put("/goals", response_model=AnalyticsResponse)
async def update_goals(
    data: StudyGoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> AnalyticsResponse:
    """Set the user's daily and/or weekly study-hour goals."""
    analytics = await _analytics_service.update_study_goals(db, current_user.id, data)
    return AnalyticsResponse.model_validate(analytics)


@router.put("/session/{session_id}/end", response_model=StudySessionResponse)
async def end_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> StudySessionResponse:
    """End an active study session and calculate duration."""
    session = await _analytics_service.end_study_session(db, session_id, current_user.id)
    return StudySessionResponse.model_validate(session)
