"""
Export router — /api/v1/export
Generates and returns downloadable files (PDF, DOCX, Markdown).
"""
from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_active_user, get_db, get_embedding_service, get_llm_service, get_vector_store
from app.core.exceptions import NotFoundException, PermissionException
from app.models.flashcard import FlashcardSet
from app.models.quiz import Quiz, QuizAttempt
from app.models.user import User
from app.schemas.summary import SummaryRequest
from app.services.export_service import ExportService
from app.services.quiz_service import QuizService
from app.services.rag_service import RAGService
from app.services.summary_service import SummaryService

from sqlalchemy import select

router = APIRouter()
_export_service = ExportService()
_summary_service = SummaryService()
_quiz_service = QuizService()

_MIME = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "markdown": "text/markdown; charset=utf-8",
}
_EXT = {"pdf": "pdf", "docx": "docx", "markdown": "md"}


def _get_rag_service() -> RAGService:
    return RAGService(
        vector_store_service=get_vector_store(),
        embedding_service=get_embedding_service(),
        llm_service=get_llm_service(),
    )


# ── Export summary ────────────────────────────────────────────────────────────
@router.get("/summary/{document_id}")
async def export_summary(
    document_id: uuid.UUID,
    format: Literal["pdf", "docx", "markdown"] = Query(default="pdf"),
    summary_type: Literal["short", "detailed", "bullet", "one_page", "exam_revision"] = Query(default="detailed"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Response:
    """Generate a summary and return it as a downloadable file."""
    rag = _get_rag_service()
    summary_resp = await _summary_service.generate_summary(
        db,
        current_user.id,
        SummaryRequest(document_id=document_id, summary_type=summary_type),
        rag,
    )
    title = f"Summary — {summary_type.replace('_', ' ').title()}"
    content = summary_resp.summary

    if format == "pdf":
        file_bytes = _export_service.export_to_pdf(content, title)
    elif format == "docx":
        file_bytes = _export_service.export_to_docx(content, title)
    else:
        file_bytes = _export_service.export_to_markdown(content, title)

    filename = f"summary_{document_id}.{_EXT[format]}"
    return Response(
        content=file_bytes,
        media_type=_MIME[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Export quiz results ───────────────────────────────────────────────────────
@router.get("/quiz/{quiz_id}")
async def export_quiz(
    quiz_id: uuid.UUID,
    format: Literal["pdf"] = Query(default="pdf"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Response:
    """Export quiz questions and (latest) attempt results as a PDF."""
    quiz = await _quiz_service.get_quiz(db, quiz_id, current_user.id)

    # Get the most recent attempt by this user for this quiz
    attempt_result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == current_user.id)
        .order_by(QuizAttempt.completed_at.desc())
        .limit(1)
    )
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        # Export blank quiz (no attempt yet) — still useful
        from app.services.export_service import _build_pdf, _text_to_lines  # noqa: PLC0415
        lines = []
        for idx, q in enumerate(quiz.questions, start=1):
            lines.append(("h2", f"Q{idx}: {q.question_text}"))
            if q.options:
                for opt in q.options:
                    lines.append(("bullet", opt))
        file_bytes = _build_pdf(quiz.title, lines)
    else:
        file_bytes = _export_service.export_quiz_pdf(quiz, attempt)

    filename = f"quiz_{quiz_id}.pdf"
    return Response(
        content=file_bytes,
        media_type=_MIME["pdf"],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Export flashcard set ──────────────────────────────────────────────────────
@router.get("/flashcards/{set_id}")
async def export_flashcards(
    set_id: uuid.UUID,
    format: Literal["pdf"] = Query(default="pdf"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Response:
    """Export a flashcard set as a PDF."""
    result = await db.execute(
        select(FlashcardSet)
        .options(selectinload(FlashcardSet.cards))
        .where(FlashcardSet.id == set_id)
    )
    fc_set = result.scalar_one_or_none()
    if not fc_set:
        raise NotFoundException("FlashcardSet", str(set_id))
    if fc_set.user_id != current_user.id:
        raise PermissionException()

    file_bytes = _export_service.export_flashcards_pdf(fc_set, list(fc_set.cards))
    filename = f"flashcards_{set_id}.pdf"
    return Response(
        content=file_bytes,
        media_type=_MIME["pdf"],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
