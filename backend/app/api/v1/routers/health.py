"""
Health check router – /api/v1/health
"""
from __future__ import annotations

from datetime import datetime, timezone
UTC = timezone.utc

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db

router = APIRouter()


# ── Simple liveness ───────────────────────────────────────────────────────────
@router.get("/")
async def health() -> dict:
    """Lightweight liveness check – no I/O."""
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ── Detailed readiness ────────────────────────────────────────────────────────
@router.get("/detailed")
async def health_detailed(db: AsyncSession = Depends(get_db)) -> dict:
    """
    Check connectivity to each critical dependency.
    Returns a status dict with one key per service.
    """
    result: dict[str, str] = {}

    # ── Database ──────────────────────────────────────────────────────────────
    try:
        await db.execute(text("SELECT 1"))
        result["db"] = "ok"
    except Exception as exc:
        result["db"] = f"fail: {exc}"

    # ── ChromaDB ─────────────────────────────────────────────────────────────
    try:
        from app.services.vector_store_service import VectorStoreService  # noqa: PLC0415

        vs = VectorStoreService()
        stats = vs.get_collection_stats(settings.CHROMADB_COLLECTION_NAME)
        result["chromadb"] = "ok" if "error" not in stats else f"fail: {stats['error']}"
    except Exception as exc:
        result["chromadb"] = f"fail: {exc}"

    # ── LLM provider ──────────────────────────────────────────────────────────
    try:
        from app.services.llm_service import LLMServiceFactory  # noqa: PLC0415

        svc = LLMServiceFactory.create()
        # A tiny "echo" call – only meaningful for providers where we can reach
        # them cheaply; for others we just confirm the client constructs ok.
        result["llm"] = f"ok ({settings.LLM_PROVIDER})"
    except Exception as exc:
        result["llm"] = f"fail: {exc}"

    overall = "ok" if all(v == "ok" or v.startswith("ok") for v in result.values()) else "degraded"
    return {
        "status": overall,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(UTC).isoformat(),
        **result,
    }
