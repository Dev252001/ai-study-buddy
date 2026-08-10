"""
Document upload, processing orchestration, and management service.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import DocumentProcessingException, NotFoundException, PermissionException
from app.models.document import Document, DocumentChunk
from app.models.analytics import StudySession, UserAnalytics

logger = logging.getLogger(__name__)

# Mapping of file extension → processor
_PROCESSOR_MAP: dict[str, str] = {
    "pdf": "pdf",
    "docx": "docx",
    "pptx": "pptx",
    "txt": "text",
    "md": "text",
    "markdown": "text",
}


class DocumentService:
    # ------------------------------------------------------------------
    # Upload
    # ------------------------------------------------------------------
    async def upload_document(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        file: UploadFile,
        background_tasks: BackgroundTasks,
        title: str | None = None,
        subject: str | None = None,
        description: str | None = None,
        tags: list[str] | None = None,
    ) -> Document:
        """Save the uploaded file and enqueue background processing."""
        original_filename = file.filename or "upload"
        ext = Path(original_filename).suffix.lstrip(".").lower()

        if ext not in settings.allowed_extensions_list:
            raise DocumentProcessingException(
                f"File type '.{ext}' is not allowed. "
                f"Allowed: {', '.join(settings.allowed_extensions_list)}"
            )

        # Ensure per-user upload directory exists
        user_dir = settings.upload_path / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        # Write file to disk with a unique name to avoid collisions
        unique_name = f"{uuid.uuid4().hex}_{original_filename}"
        file_path = user_dir / unique_name

        content = await file.read()
        if len(content) > settings.max_upload_bytes:
            raise DocumentProcessingException(
                f"File exceeds the maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )
        file_path.write_bytes(content)

        doc = Document(
            user_id=str(user_id),
            title=title or Path(original_filename).stem,
            filename=original_filename,
            file_path=str(file_path),
            file_type=ext,
            file_size=len(content),
            status="pending",
            subject=subject,
            description=description,
            tags=tags or [],
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)

        background_tasks.add_task(self._process_document_background, str(doc.id))
        logger.info("document_uploaded", extra={"doc_id": str(doc.id), "user_id": str(user_id)})
        return doc

    # ------------------------------------------------------------------
    # Background processing entry-point
    # ------------------------------------------------------------------
    async def _process_document_background(self, document_id: str) -> None:
        """Thin wrapper so BackgroundTasks can call an async method."""
        from app.core.database import AsyncSessionLocal  # noqa: PLC0415

        async with AsyncSessionLocal() as db:
            await self.process_document(db, document_id)

    # ------------------------------------------------------------------
    # Full processing pipeline
    # ------------------------------------------------------------------
    async def process_document(self, db: AsyncSession, document_id: str) -> None:
        """
        extract_text → chunk_text → embed_chunks → store_in_chromadb → update_status
        """
        doc = await self._get_doc_by_id(db, document_id)
        if doc is None:
            logger.error("process_document_not_found", extra={"doc_id": document_id})
            return

        # Mark as processing
        doc.status = "processing"
        await db.commit()

        try:
            # ── 1. Extract text ──────────────────────────────────────────────
            text, page_count = self.extract_text(doc)
            if not text.strip():
                raise DocumentProcessingException("No text could be extracted from the file.")

            # ── 2. Chunk text ────────────────────────────────────────────────
            from app.services.chunking_service import ChunkingService  # noqa: PLC0415

            chunker = ChunkingService()
            chunks = chunker.chunk_text(
                text,
                document_id=str(doc.id),
                metadata={
                    "document_id": str(doc.id),
                    "user_id": str(doc.user_id),
                    "title": doc.title,
                    "file_type": doc.file_type,
                },
            )

            # ── 3. Embed chunks ───────────────────────────────────────────────
            from app.services.embedding_service import EmbeddingService  # noqa: PLC0415

            embedder = EmbeddingService()
            texts = [c["content"] for c in chunks]
            embeddings = embedder.embed_texts(texts)

            # ── 4. Store in ChromaDB ──────────────────────────────────────────
            from app.services.vector_store_service import VectorStoreService  # noqa: PLC0415

            vs = VectorStoreService()
            collection_name = settings.CHROMADB_COLLECTION_NAME
            vs.get_or_create_collection(collection_name)
            vs.add_chunks(collection_name, chunks, embeddings)

            # ── 5. Persist chunks to DB ──────────────────────────────────────
            # Remove any previous chunks (re-process scenario) using a direct
            # DELETE so we never trigger a sync lazy-load on doc.chunks.
            await db.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id == str(doc.id))
            )
            await db.flush()

            for chunk in chunks:
                db_chunk = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=chunk["chunk_index"],
                    content=chunk["content"],
                    page_number=chunk.get("page_number"),
                    char_start=chunk.get("char_start"),
                    char_end=chunk.get("char_end"),
                    chunk_metadata=chunk.get("metadata", {}),
                    vector_id=chunk.get("vector_id"),
                )
                db.add(db_chunk)

            # ── 6. Update document stats ─────────────────────────────────────
            doc.status = "ready"
            doc.page_count = page_count
            doc.word_count = len(text.split())
            doc.char_count = len(text)
            doc.vector_collection_id = collection_name
            doc.processing_error = None
            await db.commit()

            # Update user analytics
            await self._increment_analytics(db, doc.user_id)
            logger.info("document_processed", extra={"doc_id": str(doc.id)})

        except Exception as exc:
            logger.exception("document_processing_failed", extra={"doc_id": document_id})
            doc.status = "failed"
            doc.processing_error = str(exc)
            await db.commit()

    # ------------------------------------------------------------------
    # Text extraction dispatcher
    # ------------------------------------------------------------------
    def extract_text(self, doc: Document) -> tuple[str, int]:
        """Route to the appropriate processor based on file_type."""
        processor_key = _PROCESSOR_MAP.get(doc.file_type.lower())
        if processor_key is None:
            raise DocumentProcessingException(f"No processor available for type '{doc.file_type}'.")

        if processor_key == "pdf":
            from app.services.document_processors.pdf_processor import PDFProcessor  # noqa: PLC0415
            return PDFProcessor().extract_text(doc.file_path)
        if processor_key == "docx":
            from app.services.document_processors.docx_processor import DOCXProcessor  # noqa: PLC0415
            return DOCXProcessor().extract_text(doc.file_path)
        if processor_key == "pptx":
            from app.services.document_processors.pptx_processor import PPTXProcessor  # noqa: PLC0415
            return PPTXProcessor().extract_text(doc.file_path)
        if processor_key == "text":
            from app.services.document_processors.text_processor import TextProcessor  # noqa: PLC0415
            return TextProcessor().extract_text(doc.file_path)

        raise DocumentProcessingException(f"Unknown processor key '{processor_key}'.")

    # ------------------------------------------------------------------
    # CRUD helpers
    # ------------------------------------------------------------------
    async def get_document(
        self, db: AsyncSession, document_id: str, user_id: uuid.UUID
    ) -> Document:
        doc = await self._get_doc_by_id(db, document_id)
        if not doc:
            raise NotFoundException("Document", document_id)
        if str(doc.user_id) != str(user_id):
            raise PermissionException()
        return doc

    async def list_documents(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Document], int]:
        count_result = await db.execute(
            select(func.count()).select_from(Document).where(Document.user_id == str(user_id))
        )
        total = count_result.scalar_one()

        result = await db.execute(
            select(Document)
            .where(Document.user_id == str(user_id))
            .order_by(Document.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        docs = list(result.scalars().all())
        return docs, total

    async def delete_document(
        self, db: AsyncSession, document_id: str, user_id: uuid.UUID
    ) -> None:
        doc = await self.get_document(db, document_id, user_id)

        # Delete vectors from ChromaDB
        try:
            from app.services.vector_store_service import VectorStoreService  # noqa: PLC0415

            vs = VectorStoreService()
            vs.delete_document_chunks(settings.CHROMADB_COLLECTION_NAME, document_id)
        except Exception as exc:
            logger.warning("chromadb_delete_failed", extra={"error": str(exc)})

        # Delete file from disk
        try:
            Path(doc.file_path).unlink(missing_ok=True)
        except Exception as exc:
            logger.warning("file_delete_failed", extra={"error": str(exc)})

        await db.delete(doc)
        await db.commit()
        logger.info("document_deleted", extra={"doc_id": document_id})

    async def get_document_chunks(
        self, db: AsyncSession, document_id: str, user_id: uuid.UUID
    ) -> list[DocumentChunk]:
        await self.get_document(db, document_id, user_id)  # ownership check
        result = await db.execute(
            select(DocumentChunk)
            .where(DocumentChunk.document_id == str(document_id))
            .order_by(DocumentChunk.chunk_index)
        )
        return list(result.scalars().all())

    async def reprocess_document(
        self, db: AsyncSession, document_id: str, user_id: uuid.UUID
    ) -> None:
        doc = await self.get_document(db, document_id, user_id)
        doc.status = "pending"
        doc.processing_error = None
        await db.commit()
        # Run in a separate task so the HTTP response returns immediately
        asyncio.create_task(self._process_document_background(document_id))

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------
    async def _get_doc_by_id(self, db: AsyncSession, document_id: str) -> Optional[Document]:
        try:
            # Normalise to canonical UUID string with dashes — the column is String(36)
            uid_str = str(uuid.UUID(document_id))
        except ValueError:
            return None
        result = await db.execute(select(Document).where(Document.id == uid_str))
        return result.scalar_one_or_none()

    async def _increment_analytics(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        from datetime import datetime, timezone  # noqa: PLC0415
        UTC = timezone.utc
        result = await db.execute(
            select(UserAnalytics).where(UserAnalytics.user_id == str(user_id))
        )
        analytics = result.scalar_one_or_none()
        if analytics:
            analytics.total_documents += 1
            # Credit 5 minutes per document processed as study time
            analytics.total_study_hours = round(analytics.total_study_hours + 5 / 60, 4)
            now = datetime.now(UTC)
            analytics.last_active = now
            db.add(StudySession(
                user_id=str(user_id),
                activity_type="document",
                started_at=now,
                ended_at=now,
                duration_minutes=5,
            ))
            await db.commit()
