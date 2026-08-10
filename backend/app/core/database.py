"""
SQLAlchemy async + sync database engines and session factories.
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, MappedColumn, Session, sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ── Declarative base ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Shared base for all ORM models."""


# ── Async engine – used by the application at runtime ────────────────────────
_async_url = settings.DATABASE_URL
# Ensure the async driver prefix is correct
if _async_url.startswith("sqlite:///"):
    _async_url = _async_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
elif _async_url.startswith("postgresql://") and "+asyncpg" not in _async_url:
    _async_url = _async_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif _async_url.startswith("postgres://"):
    _async_url = _async_url.replace("postgres://", "postgresql+asyncpg://", 1)

_is_sqlite = _async_url.startswith("sqlite")

_engine_kwargs: dict = {"echo": settings.DEBUG}
if not _is_sqlite:
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20

async_engine = create_async_engine(_async_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ── Sync engine – used by Alembic migrations only ────────────────────────────
_sync_url = settings.DATABASE_URL
if _sync_url.startswith("sqlite+aiosqlite"):
    _sync_url = _sync_url.replace("sqlite+aiosqlite", "sqlite", 1)

sync_engine = create_engine(
    _sync_url,
    echo=settings.DEBUG,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autoflush=False,
    autocommit=False,
)


# ── FastAPI dependency ────────────────────────────────────────────────────────
async def get_db() -> AsyncSession:  # type: ignore[return]
    """Yield an async DB session; roll back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Application startup ───────────────────────────────────────────────────────
async def init_db() -> None:
    """Create all tables that don't already exist (non-destructive)."""
    # Import models so their metadata is registered on Base before create_all.
    import app.models  # noqa: F401, PLC0415

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Add new columns that may be missing from existing databases
        await conn.run_sync(_apply_column_migrations)
    logger.info("database_initialized")


def _apply_column_migrations(connection) -> None:  # type: ignore[no-untyped-def]
    """Idempotent column additions for schema evolution without full Alembic."""
    from sqlalchemy import inspect, text  # noqa: PLC0415

    inspector = inspect(connection)
    tables = inspector.get_table_names()

    # user_analytics: add study goal columns
    if "user_analytics" in tables:
        existing = {c["name"] for c in inspector.get_columns("user_analytics")}
        if "daily_goal_hours" not in existing:
            connection.execute(
                text("ALTER TABLE user_analytics ADD COLUMN daily_goal_hours FLOAT NOT NULL DEFAULT 2.0")
            )
        if "weekly_goal_hours" not in existing:
            connection.execute(
                text("ALTER TABLE user_analytics ADD COLUMN weekly_goal_hours FLOAT NOT NULL DEFAULT 10.0")
            )

    # chat_messages: add suggested_questions column (Priority 8)
    if "chat_messages" in tables:
        existing = {c["name"] for c in inspector.get_columns("chat_messages")}
        if "suggested_questions" not in existing:
            connection.execute(
                text("ALTER TABLE chat_messages ADD COLUMN suggested_questions JSON")
            )
