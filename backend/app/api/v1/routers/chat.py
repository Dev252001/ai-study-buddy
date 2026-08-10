"""
Chat router – /api/v1/chat
"""
from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.chat import (
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionCreate,
    ChatSessionResponse,
)
from app.services.chat_service import ChatService
from app.services.rag_service import RAGService

router = APIRouter()
_chat_svc = ChatService()


def _get_rag_service() -> RAGService:
    """Lazy singleton – instantiated once per worker process."""
    return RAGService()


# ── Create session ────────────────────────────────────────────────────────────
@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: ChatSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await _chat_svc.create_session(db, current_user.id, data)


# ── List sessions ─────────────────────────────────────────────────────────────
@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    return await _chat_svc.list_sessions(db, current_user.id)


# ── Get session ───────────────────────────────────────────────────────────────
@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await _chat_svc.get_session(db, session_id, current_user.id)


# ── Delete session ────────────────────────────────────────────────────────────
@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
async def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await _chat_svc.delete_session(db, session_id, current_user.id)
    return {"message": "Session deleted successfully."}


# ── Send message ──────────────────────────────────────────────────────────────
@router.post("/message", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    rag = _get_rag_service()
    return await _chat_svc.send_message(db, current_user.id, request, rag)


# ── Get session messages ──────────────────────────────────────────────────────
@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_session_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    return await _chat_svc.get_messages(db, session_id, current_user.id)
