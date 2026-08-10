"""
Search router – /api/v1/search
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import get_current_active_user
from app.models.user import User
from app.schemas.document import SearchRequest, SearchResponse
from app.services.rag_service import RAGService

router = APIRouter()


def _get_rag_service() -> RAGService:
    return RAGService()


async def _execute_search(
    request: SearchRequest,
    current_user: User,
) -> SearchResponse:
    """Shared logic used by both search endpoints."""
    rag = _get_rag_service()
    doc_id_strings = [str(d) for d in request.document_ids] if request.document_ids else None

    results = await rag.retrieve(
        query=request.query,
        document_ids=doc_id_strings,
        n_results=request.limit,
        score_threshold=request.threshold,
    )

    return SearchResponse(
        query=request.query,
        results=results,
        total=len(results),
    )


@router.post("/", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    current_user: User = Depends(get_current_active_user),
) -> SearchResponse:
    """Semantic search across the user's documents (or a subset)."""
    return await _execute_search(request, current_user)


@router.post("/semantic", response_model=SearchResponse)
async def semantic_search(
    request: SearchRequest,
    current_user: User = Depends(get_current_active_user),
) -> SearchResponse:
    """Explicitly named semantic search endpoint (same behaviour as POST /)."""
    return await _execute_search(request, current_user)
