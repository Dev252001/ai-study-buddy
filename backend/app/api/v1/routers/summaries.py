"""
Summaries & AI router — /api/v1/summaries
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db, get_embedding_service, get_llm_service, get_vector_store
from app.models.user import User
from app.schemas.summary import (
    ConceptExplainRequest,
    ConceptExplainResponse,
    SummaryRequest,
    SummaryResponse,
)
from app.services.rag_service import RAGService
from app.services.summary_service import SummaryService

router = APIRouter()
_summary_service = SummaryService()


def _get_rag_service() -> RAGService:
    return RAGService(
        vector_store_service=get_vector_store(),
        embedding_service=get_embedding_service(),
        llm_service=get_llm_service(),
    )


# ── Request body models for simple endpoints ──────────────────────────────────
class MindMapRequest(BaseModel):
    document_id: uuid.UUID


class StudyPlanRequest(BaseModel):
    document_id: uuid.UUID
    exam_date: str  # ISO date string e.g. "2024-12-31"


class FormulaSheetRequest(BaseModel):
    document_id: uuid.UUID


class GlossaryRequest(BaseModel):
    document_id: uuid.UUID


# ── Summarise ─────────────────────────────────────────────────────────────────
@router.post("/summarize", response_model=SummaryResponse)
async def summarize(
    request: SummaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SummaryResponse:
    """Generate a summary of a document."""
    rag = _get_rag_service()
    return await _summary_service.generate_summary(db, current_user.id, request, rag)


# ── Explain concept ───────────────────────────────────────────────────────────
@router.post("/explain", response_model=ConceptExplainResponse)
async def explain_concept(
    request: ConceptExplainRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ConceptExplainResponse:
    """Explain a concept at the requested comprehension level."""
    rag = _get_rag_service()
    return await _summary_service.explain_concept(db, current_user.id, request, rag)


# ── Mind map ──────────────────────────────────────────────────────────────────
@router.post("/mind-map")
async def mind_map(
    request: MindMapRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Generate a hierarchical mind-map structure from a document."""
    rag = _get_rag_service()
    result = await _summary_service.generate_mind_map(db, current_user.id, request.document_id, rag)
    return {"mind_map": result}


# ── Study plan ────────────────────────────────────────────────────────────────
@router.post("/study-plan")
async def study_plan(
    request: StudyPlanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Generate a structured daily study plan up to an exam date."""
    rag = _get_rag_service()
    result = await _summary_service.generate_study_plan(
        db, current_user.id, request.document_id, request.exam_date, rag
    )
    return {"study_plan": result}


# ── Formula sheet ─────────────────────────────────────────────────────────────
@router.post("/formula-sheet")
async def formula_sheet(
    request: FormulaSheetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Extract all formulas and equations from a document."""
    rag = _get_rag_service()
    result = await _summary_service.generate_formula_sheet(db, current_user.id, request.document_id, rag)
    # result is already {"formulas": [...]} from the LLM — return it directly
    return result


# ── Glossary ──────────────────────────────────────────────────────────────────
@router.post("/glossary")
async def glossary(
    request: GlossaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    """Extract key terms and their definitions from a document."""
    rag = _get_rag_service()
    result = await _summary_service.generate_glossary(db, current_user.id, request.document_id, rag)
    # result is already {"term": "def", ...} from the LLM — wrap it correctly
    return {"glossary": result}
