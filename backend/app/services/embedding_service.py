"""
Embedding service – singleton wrapper around SentenceTransformer.
"""
from __future__ import annotations

import logging
from threading import Lock
from typing import ClassVar

logger = logging.getLogger(__name__)

_LOCK = Lock()


class EmbeddingService:
    """
    Lazily loads the SentenceTransformer model and exposes embed_text /
    embed_texts / embed_query helpers.

    A single model instance is shared across the process (singleton).
    """

    _instance: ClassVar["EmbeddingService | None"] = None
    _model = None  # type: ignore[assignment]

    def __new__(cls, model_name: str = "all-MiniLM-L6-v2") -> "EmbeddingService":
        with _LOCK:
            if cls._instance is None:
                obj = super().__new__(cls)
                obj._model_name = model_name
                obj._model = None
                cls._instance = obj
            return cls._instance

    # ------------------------------------------------------------------
    @property
    def model(self):  # type: ignore[return]
        if self._model is None:
            with _LOCK:
                if self._model is None:
                    from sentence_transformers import SentenceTransformer  # noqa: PLC0415

                    logger.info("loading_embedding_model", extra={"model": self._model_name})
                    self._model = SentenceTransformer(self._model_name)
                    logger.info("embedding_model_loaded")
        return self._model

    # ------------------------------------------------------------------
    def embed_text(self, text: str) -> list[float]:
        """Embed a single text string."""
        embedding = self.model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Batch-embed a list of texts (more efficient than calling embed_text in a loop)."""
        if not texts:
            return []
        embeddings = self.model.encode(texts, normalize_embeddings=True, batch_size=32)
        return [e.tolist() for e in embeddings]

    def embed_query(self, query: str) -> list[float]:
        """
        Embed a search query.
        Some models benefit from a 'query:' prefix – we keep it simple here
        but the method exists as a distinct hook for future fine-tuning.
        """
        return self.embed_text(query)
