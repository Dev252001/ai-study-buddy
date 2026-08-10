"""
RAG (Retrieval-Augmented Generation) service.
Combines vector similarity search with an LLM to produce grounded answers.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from app.core.config import settings
from app.schemas.chat import Citation
from app.schemas.document import SearchResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates per interaction mode
# ---------------------------------------------------------------------------
_SYSTEM_PROMPTS: dict[str, str] = {
    "rag": (
        "You are a helpful, accurate study tutor. "
        "Answer the student's question using ONLY the provided document excerpts. "
        "Always cite your sources by referencing the document title and page number. "
        "If the answer is not in the excerpts, say so clearly."
    ),
    "general": (
        "You are a helpful study assistant. "
        "Answer the student's question thoughtfully and clearly."
    ),
    "explain": (
        "You are an expert teacher. "
        "Explain the concept from the provided document excerpts in simple terms, "
        "using analogies and examples where helpful. "
        "Cite the relevant sections."
    ),
    "summarize": (
        "You are a concise summariser. "
        "Create a structured summary of the provided document excerpts, "
        "highlighting key concepts, definitions, and relationships."
    ),
    "quiz_hint": (
        "You are a Socratic tutor. "
        "Rather than giving the direct answer, guide the student toward it "
        "with hints, questions, and partial explanations based on the provided excerpts."
    ),
}

_CONTEXT_TEMPLATE = (
    "--- Document Excerpt {idx} ---\n"
    "Title: {title}\n"
    "Page: {page}\n"
    "Content:\n{content}\n"
)

_RAG_USER_TEMPLATE = (
    "Context (document excerpts):\n\n"
    "{context}\n\n"
    "---\n"
    "Chat history (most recent last):\n"
    "{history}\n\n"
    "---\n"
    "Student's question:\n{question}\n\n"
    "Please provide a clear, well-structured answer based on the excerpts above. "
    "Reference specific excerpts where appropriate."
)


class RAGService:
    def __init__(
        self,
        vector_store_service=None,
        embedding_service=None,
        llm_service=None,
    ) -> None:
        if vector_store_service is None:
            from app.services.vector_store_service import VectorStoreService  # noqa: PLC0415
            vector_store_service = VectorStoreService()
        if embedding_service is None:
            from app.services.embedding_service import EmbeddingService  # noqa: PLC0415
            embedding_service = EmbeddingService()
        if llm_service is None:
            from app.services.llm_service import LLMServiceFactory  # noqa: PLC0415
            llm_service = LLMServiceFactory.create()

        self._vs = vector_store_service
        self._embedder = embedding_service
        self._llm = llm_service

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    async def retrieve(
        self,
        query: str,
        document_ids: list[str] | None = None,
        n_results: int = 5,
        score_threshold: float = 0.0,
    ) -> list[SearchResult]:
        """
        Embed *query*, search ChromaDB, and return ranked SearchResult objects.
        Optionally filter to a specific set of document IDs.
        """
        query_embedding = self._embedder.embed_query(query)

        chroma_filter: dict[str, Any] | None = None
        if document_ids:
            if len(document_ids) == 1:
                chroma_filter = {"document_id": document_ids[0]}
            else:
                chroma_filter = {"document_id": {"$in": document_ids}}

        raw_hits = self._vs.search(
            collection_name=settings.CHROMADB_COLLECTION_NAME,
            query_embedding=query_embedding,
            n_results=n_results,
            filter=chroma_filter,
        )

        results: list[SearchResult] = []
        for hit in raw_hits:
            if hit["score"] < score_threshold:
                continue
            meta = hit.get("metadata", {})
            try:
                chunk_id = uuid.UUID(hit["id"])
            except (ValueError, KeyError):
                chunk_id = uuid.uuid4()
            try:
                doc_id = uuid.UUID(str(meta.get("document_id", "")))
            except ValueError:
                doc_id = uuid.uuid4()

            results.append(
                SearchResult(
                    chunk_id=chunk_id,
                    document_id=doc_id,
                    document_title=str(meta.get("title", "Unknown document")),
                    content=hit["content"],
                    score=hit["score"],
                    page_number=int(meta["page_number"]) if meta.get("page_number") else None,
                )
            )

        return results

    # ------------------------------------------------------------------
    # Answer generation
    # ------------------------------------------------------------------
    async def generate_answer(
        self,
        query: str,
        retrieved_chunks: list[SearchResult],
        chat_history: list[dict[str, str]] | None = None,
        mode: str = "rag",
    ) -> tuple[str, list[Citation]]:
        """
        Build a prompt from retrieved chunks and call the LLM.
        Returns *(answer_text, citations)*.
        """
        system_prompt = _SYSTEM_PROMPTS.get(mode, _SYSTEM_PROMPTS["rag"])

        # Build context block from retrieved chunks
        context_parts: list[str] = []
        for idx, chunk in enumerate(retrieved_chunks, start=1):
            context_parts.append(
                _CONTEXT_TEMPLATE.format(
                    idx=idx,
                    title=chunk.document_title,
                    page=chunk.page_number or "N/A",
                    content=chunk.content,
                )
            )
        context = "\n".join(context_parts) if context_parts else "No relevant excerpts found."

        # Format recent chat history (up to last 10 exchanges)
        history_lines: list[str] = []
        for msg in (chat_history or [])[-10:]:
            role = msg.get("role", "user").capitalize()
            history_lines.append(f"{role}: {msg.get('content', '')}")
        history = "\n".join(history_lines) if history_lines else "None"

        user_prompt = _RAG_USER_TEMPLATE.format(
            context=context,
            history=history,
            question=query,
        )

        answer = await self._llm.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=1500,
        )

        # Build citations from the retrieved chunks
        citations: list[Citation] = [
            Citation(
                document_id=chunk.document_id,
                document_title=chunk.document_title,
                chunk_content=chunk.content[:300],
                page_number=chunk.page_number,
                score=chunk.score,
            )
            for chunk in retrieved_chunks
        ]

        return answer, citations

    # ------------------------------------------------------------------
    # Combined pipeline
    # ------------------------------------------------------------------
    async def answer_with_rag(
        self,
        query: str,
        document_ids: list[str] | None = None,
        chat_history: list[dict[str, str]] | None = None,
        mode: str = "rag",
        n_results: int = 5,
    ) -> tuple[str, list[Citation]]:
        """Retrieve relevant chunks then generate a grounded answer."""
        chunks = await self.retrieve(query, document_ids=document_ids, n_results=n_results)
        return await self.generate_answer(query, chunks, chat_history=chat_history, mode=mode)
