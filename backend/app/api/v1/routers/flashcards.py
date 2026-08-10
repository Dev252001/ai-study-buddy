"""
Flashcards router — /api/v1/flashcards
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db, get_embedding_service, get_llm_service, get_vector_store
from app.models.user import User
from app.schemas.flashcard import (
    FlashcardResponse,
    FlashcardReviewRequest,
    FlashcardSetGenerateRequest,
    FlashcardSetResponse,
)
from app.services.flashcard_service import FlashcardService
from app.services.rag_service import RAGService

router = APIRouter()
_flashcard_service = FlashcardService()


def _get_rag_service() -> RAGService:
    return RAGService(
        vector_store_service=get_vector_store(),
        embedding_service=get_embedding_service(),
        llm_service=get_llm_service(),
    )


# ── Generate set ──────────────────────────────────────────────────────────────
@router.post("/generate", response_model=FlashcardSetResponse, status_code=201)
async def generate_flashcards(
    request: FlashcardSetGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> FlashcardSetResponse:
    """Generate a flashcard set from a document using the LLM."""
    rag = _get_rag_service()
    fc_set = await _flashcard_service.generate_flashcards(db, current_user.id, request, rag)
    return FlashcardSetResponse.model_validate(fc_set)


# ── List sets ─────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[FlashcardSetResponse])
async def list_sets(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[FlashcardSetResponse]:
    """List all flashcard sets for the current user."""
    sets = await _flashcard_service.list_sets(db, current_user.id, skip=skip, limit=limit)
    return [FlashcardSetResponse.model_validate(s) for s in sets]


# ── Get single set ────────────────────────────────────────────────────────────
@router.get("/{set_id}", response_model=FlashcardSetResponse)
async def get_set(
    set_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> FlashcardSetResponse:
    """Retrieve a single flashcard set with all its cards."""
    fc_set = await _flashcard_service.get_set(db, set_id, current_user.id)
    return FlashcardSetResponse.model_validate(fc_set)


# ── Get cards for a set ───────────────────────────────────────────────────────
@router.get("/{set_id}/cards", response_model=list[FlashcardResponse])
async def get_cards(
    set_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[FlashcardResponse]:
    """Retrieve all cards belonging to a flashcard set."""
    cards = await _flashcard_service.get_cards(db, set_id, current_user.id)
    return [FlashcardResponse.model_validate(c) for c in cards]


# ── Delete set ────────────────────────────────────────────────────────────────
@router.delete("/{set_id}")
async def delete_set(
    set_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Delete a flashcard set and all its cards."""
    await _flashcard_service.delete_set(db, set_id, current_user.id)
    return {"message": "Flashcard set deleted successfully."}


# ── Review a card ─────────────────────────────────────────────────────────────
@router.post("/review")
async def review_card(
    request: FlashcardReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Record a flashcard review (correct/incorrect) and update stats."""
    await _flashcard_service.review_card(db, current_user.id, request)
    return {"message": "Review recorded successfully."}
