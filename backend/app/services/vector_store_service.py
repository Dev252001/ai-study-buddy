"""
Vector store service – ChromaDB adapter.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """
    Wraps ChromaDB (persistent local client or HTTP client) and provides
    collection management, chunk insertion, similarity search, and deletion.
    """

    def __init__(
        self,
        host: str = "",
        port: int = 8000,
        collection_name: str = "",
        embedding_model: str = "",
        persist_directory: str = ".chromadb",
    ) -> None:
        self._host = host or settings.CHROMADB_HOST
        self._port = port or settings.CHROMADB_PORT
        self._default_collection = collection_name or settings.CHROMADB_COLLECTION_NAME
        self._client = self._build_client(persist_directory)

    # ------------------------------------------------------------------
    def _build_client(self, persist_directory: str):  # type: ignore[return]
        import chromadb  # noqa: PLC0415

        # If host is localhost / 127.0.0.1 and port is the default, use the
        # lightweight persistent client so no separate ChromaDB server is needed.
        if self._host in ("localhost", "127.0.0.1", "local", ""):
            try:
                client = chromadb.PersistentClient(path=persist_directory)
                logger.info("chromadb_persistent_client_created")
                return client
            except Exception as exc:
                logger.warning("chromadb_persistent_client_failed", extra={"error": str(exc)})

        # Fall back to HTTP client (requires a running ChromaDB server)
        try:
            client = chromadb.HttpClient(host=self._host, port=self._port)
            logger.info("chromadb_http_client_created")
            return client
        except Exception as exc:
            logger.error("chromadb_http_client_failed", extra={"error": str(exc)})
            raise

    # ------------------------------------------------------------------
    def get_or_create_collection(self, collection_name: str):  # type: ignore[return]
        """Return an existing ChromaDB collection or create it."""
        return self._client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    # ------------------------------------------------------------------
    def add_chunks(
        self,
        collection_name: str,
        chunks: list[dict[str, Any]],
        embeddings: list[list[float]],
    ) -> None:
        """
        Upsert *chunks* and their *embeddings* into the named collection.

        Each chunk dict must contain at minimum: ``id``, ``content``, ``metadata``.
        """
        if not chunks:
            return

        collection = self.get_or_create_collection(collection_name)

        ids = [c["id"] for c in chunks]
        documents = [c["content"] for c in chunks]
        metadatas: list[dict[str, Any]] = []

        for c in chunks:
            # ChromaDB metadata values must be str | int | float | bool
            meta: dict[str, Any] = {}
            for k, v in (c.get("metadata") or {}).items():
                if isinstance(v, (str, int, float, bool)):
                    meta[k] = v
                else:
                    meta[k] = str(v)
            metadatas.append(meta)

        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        logger.debug(
            "chromadb_chunks_upserted",
            extra={"collection": collection_name, "count": len(chunks)},
        )

    # ------------------------------------------------------------------
    def search(
        self,
        collection_name: str,
        query_embedding: list[float],
        n_results: int = 5,
        filter: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        """
        Nearest-neighbour search.  Returns a list of result dicts::

            {
                "id": str,
                "content": str,
                "metadata": dict,
                "score": float,    # 1 - cosine_distance  (higher = more similar)
            }
        """
        collection = self.get_or_create_collection(collection_name)

        kwargs: dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": min(n_results, max(collection.count(), 1)),
            "include": ["documents", "metadatas", "distances"],
        }
        if filter:
            kwargs["where"] = filter

        try:
            results = collection.query(**kwargs)
        except Exception as exc:
            logger.error("chromadb_search_error", extra={"error": str(exc)})
            return []

        hits: list[dict[str, Any]] = []
        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for i, vid in enumerate(ids):
            distance = distances[i] if i < len(distances) else 1.0
            score = round(1.0 - distance, 4)  # cosine similarity
            hits.append(
                {
                    "id": vid,
                    "content": documents[i] if i < len(documents) else "",
                    "metadata": metadatas[i] if i < len(metadatas) else {},
                    "score": score,
                }
            )

        return hits

    # ------------------------------------------------------------------
    def delete_document_chunks(self, collection_name: str, document_id: str) -> None:
        """Remove all vectors whose metadata.document_id == *document_id*."""
        try:
            collection = self.get_or_create_collection(collection_name)
            collection.delete(where={"document_id": document_id})
            logger.info(
                "chromadb_chunks_deleted",
                extra={"collection": collection_name, "document_id": document_id},
            )
        except Exception as exc:
            logger.warning("chromadb_delete_error", extra={"error": str(exc)})

    # ------------------------------------------------------------------
    def get_collection_stats(self, collection_name: str) -> dict[str, Any]:
        """Return basic stats for the named collection."""
        try:
            collection = self.get_or_create_collection(collection_name)
            return {"name": collection_name, "count": collection.count()}
        except Exception as exc:
            return {"name": collection_name, "error": str(exc)}
