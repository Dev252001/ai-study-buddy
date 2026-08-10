"""
Documents router – /api/v1/documents
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.document import (
    DocumentChunkResponse,
    DocumentListResponse,
    DocumentResponse,
    ProcessingStatusResponse,
)
from app.services.document_service import DocumentService

router = APIRouter()
_svc = DocumentService()


# ── Upload (supports multiple files) ──────────────────────────────────────────
@router.post("/", response_model=List[DocumentResponse], status_code=status.HTTP_201_CREATED)
async def upload_documents(
    files: List[UploadFile] = File(...),
    title: Optional[str] = Form(None),
    subject: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # comma-separated
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """Upload one or more documents and enqueue processing."""
    parsed_tags = [t.strip() for t in tags.split(",")] if tags else None
    results = []
    for file in files:
        doc = await _svc.upload_document(
            db=db,
            user_id=current_user.id,
            file=file,
            background_tasks=background_tasks,
            title=title,
            subject=subject,
            description=description,
            tags=parsed_tags,
        )
        results.append(doc)
    return results


# ── List ───────────────────────────────────────────────────────────────────────
@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DocumentListResponse:
    """Paginated list of the authenticated user's documents."""
    skip = (page - 1) * page_size
    docs, total = await _svc.list_documents(db, current_user.id, skip=skip, limit=page_size)
    return DocumentListResponse(items=docs, total=total, page=page, page_size=page_size)


# ── Get single ────────────────────────────────────────────────────────────────
@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    return await _svc.get_document(db, str(document_id), current_user.id)


# ── Delete ────────────────────────────────────────────────────────────────────
@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await _svc.delete_document(db, str(document_id), current_user.id)
    return {"message": "Document deleted successfully."}


# ── Reprocess ─────────────────────────────────────────────────────────────────
@router.post("/{document_id}/reprocess", status_code=status.HTTP_202_ACCEPTED)
async def reprocess_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await _svc.reprocess_document(db, str(document_id), current_user.id)
    return {"message": "Document reprocessing started."}


# ── Chunks ────────────────────────────────────────────────────────────────────
@router.get("/{document_id}/chunks", response_model=List[DocumentChunkResponse])
async def get_document_chunks(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    return await _svc.get_document_chunks(db, str(document_id), current_user.id)


# ── Processing status ─────────────────────────────────────────────────────────
@router.get("/{document_id}/status", response_model=ProcessingStatusResponse)
async def get_processing_status(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ProcessingStatusResponse:
    doc = await _svc.get_document(db, str(document_id), current_user.id)
    return ProcessingStatusResponse(
        document_id=doc.id,
        status=doc.status,
        processing_error=doc.processing_error,
        page_count=doc.page_count,
        word_count=doc.word_count,
    )
