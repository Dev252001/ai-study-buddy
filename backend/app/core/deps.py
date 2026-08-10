"""
FastAPI reusable dependencies.
"""
from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.exceptions import AuthException, PermissionException
from app.core.security import decode_token

_bearer = HTTPBearer(auto_error=False)


# ── DB session ────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session scoped to a single request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Current user ──────────────────────────────────────────────────────────────
async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve the bearer JWT to a User ORM instance.
    Import here to avoid circular imports at module level.
    """
    from sqlalchemy import select  # noqa: PLC0415

    from app.models.user import User  # noqa: PLC0415

    if credentials is None:
        raise AuthException(detail="Missing authentication token.")

    payload = decode_token(credentials.credentials)
    user_id: str | None = payload.get("sub")
    token_type: str | None = payload.get("type")

    if not user_id or token_type != "access":
        raise AuthException(detail="Invalid token payload.")

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise AuthException(detail="User not found.")

    return user


async def get_current_active_user(
    current_user=Depends(get_current_user),
):
    """Raise if the account is deactivated."""
    if not current_user.is_active:
        raise AuthException(detail="Account is deactivated.")
    return current_user


async def get_current_admin_user(
    current_user=Depends(get_current_active_user),
):
    """Raise if the user is not an admin."""
    if not current_user.is_admin:
        raise PermissionException(detail="Admin access required.")
    return current_user


# ── Service singletons ────────────────────────────────────────────────────────
def get_vector_store():
    """
    Return the application-scoped VectorStore service.
    The actual service is imported lazily to avoid heavy startup imports
    unless a route that uses it is actually called.
    """
    from app.services.vector_store_service import VectorStoreService  # noqa: PLC0415

    return VectorStoreService(
        host=settings.CHROMADB_HOST,
        port=settings.CHROMADB_PORT,
        collection_name=settings.CHROMADB_COLLECTION_NAME,
    )


def get_embedding_service():
    """Return the embedding service based on the configured model."""
    from app.services.embedding_service import EmbeddingService  # noqa: PLC0415

    return EmbeddingService(model_name=settings.EMBEDDING_MODEL)


def get_llm_service():
    """
    Return the LLM service for the configured provider.
    Raises ImportError / ValueError for unsupported providers (caught at startup).
    """
    from app.services.llm_service import LLMServiceFactory  # noqa: PLC0415

    return LLMServiceFactory.create(settings.LLM_PROVIDER)
