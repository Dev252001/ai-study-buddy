"""
Quiz router — /api/v1/quiz
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db, get_llm_service, get_vector_store, get_embedding_service
from app.models.user import User
from app.schemas.quiz import (
    QuizAttemptRequest,
    QuizAttemptResponse,
    QuizGenerateRequest,
    QuizResponse,
)
from app.services.quiz_service import QuizService
from app.services.rag_service import RAGService

router = APIRouter()
_quiz_service = QuizService()


def _get_rag_service() -> RAGService:
    return RAGService(
        vector_store_service=get_vector_store(),
        embedding_service=get_embedding_service(),
        llm_service=get_llm_service(),
    )


# ── Generate quiz ─────────────────────────────────────────────────────────────
@router.post("/generate", response_model=QuizResponse, status_code=201)
async def generate_quiz(
    request: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> QuizResponse:
    """Generate a quiz from a document using the LLM."""
    rag = _get_rag_service()
    quiz = await _quiz_service.generate_quiz(db, current_user.id, request, rag)
    return QuizResponse.model_validate(quiz)


# ── List quizzes ──────────────────────────────────────────────────────────────
@router.get("/", response_model=list[QuizResponse])
async def list_quizzes(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[QuizResponse]:
    """List all quizzes for the current user."""
    quizzes = await _quiz_service.list_quizzes(db, current_user.id, skip=skip, limit=limit)
    return [QuizResponse.model_validate(q) for q in quizzes]


# ── Get single quiz ───────────────────────────────────────────────────────────
@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> QuizResponse:
    """Retrieve a single quiz with its questions."""
    quiz = await _quiz_service.get_quiz(db, quiz_id, current_user.id)
    return QuizResponse.model_validate(quiz)


# ── Delete quiz ───────────────────────────────────────────────────────────────
@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Delete a quiz and all its questions."""
    await _quiz_service.delete_quiz(db, quiz_id, current_user.id)
    return {"message": "Quiz deleted successfully."}


# ── Submit attempt ────────────────────────────────────────────────────────────
@router.post("/attempt", response_model=QuizAttemptResponse, status_code=201)
async def submit_attempt(
    request: QuizAttemptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> QuizAttemptResponse:
    """Submit answers for a quiz and receive a graded result."""
    return await _quiz_service.submit_attempt(db, current_user.id, request)
