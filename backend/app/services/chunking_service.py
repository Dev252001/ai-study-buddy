"""
Text chunking service.
Uses LangChain's RecursiveCharacterTextSplitter to split documents
into overlapping sentence-respecting chunks.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

logger = logging.getLogger(__name__)

_CHUNK_SIZE = 1000
_CHUNK_OVERLAP = 200
# Separators ordered from largest to smallest structural unit
_SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""]


class ChunkingService:
    def __init__(
        self,
        chunk_size: int = _CHUNK_SIZE,
        chunk_overlap: int = _CHUNK_OVERLAP,
    ) -> None:
        from langchain.text_splitter import RecursiveCharacterTextSplitter  # noqa: PLC0415

        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=_SEPARATORS,
            length_function=len,
            is_separator_regex=False,
        )

    def chunk_text(
        self,
        text: str,
        document_id: str,
        metadata: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """
        Split *text* into chunks and return a list of chunk dicts with shape::

            {
                "id": str,                # UUID for use as ChromaDB vector ID
                "content": str,
                "chunk_index": int,
                "page_number": int | None,
                "char_start": int,
                "char_end": int,
                "metadata": dict,
                "vector_id": str,
            }
        """
        if not text.strip():
            return []

        raw_chunks = self._splitter.create_documents(
            [text], metadatas=[metadata]
        )

        results: list[dict[str, Any]] = []
        cursor = 0  # running position within the original text for char offsets

        for idx, doc_chunk in enumerate(raw_chunks):
            content: str = doc_chunk.page_content

            # Find where this chunk starts in the original text (from cursor
            # onwards to handle duplicate substrings correctly)
            start = text.find(content, cursor)
            if start == -1:
                start = cursor  # fallback
            end = start + len(content)
            cursor = max(cursor, start)  # advance cursor; don't go backwards

            # Rough page number estimate (1 page ≈ 3 000 chars)
            page_number = (start // 3000) + 1

            vector_id = str(uuid.uuid4())
            results.append(
                {
                    "id": vector_id,
                    "content": content,
                    "chunk_index": idx,
                    "page_number": page_number,
                    "char_start": start,
                    "char_end": end,
                    "metadata": {
                        **metadata,
                        "chunk_index": idx,
                        "page_number": page_number,
                        "char_start": start,
                        "char_end": end,
                    },
                    "vector_id": vector_id,
                }
            )

        logger.debug(
            "text_chunked",
            extra={"document_id": document_id, "num_chunks": len(results)},
        )
        return results
