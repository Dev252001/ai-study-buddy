"""
Alembic environment script.

Supports both:
  - Online mode with asyncpg (async engine)
  - Offline mode (generates SQL without a live DB)
"""
from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

# ── Load app settings ─────────────────────────────────────────────────────────
# sys.path is set by alembic.ini prepend_sys_path = .
from app.core.config import settings  # noqa: E402

# ── Import all models so their metadata is registered on Base ─────────────────
import app.models  # noqa: F401, E402  – side-effect import
from app.core.database import Base  # noqa: E402

# ── Alembic Config object ─────────────────────────────────────────────────────
config = context.config

# Override sqlalchemy.url with the value from pydantic settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret alembic.ini [loggers] / [handlers] / [formatters] sections
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── Offline mode ──────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    """
    Emit SQL to stdout without requiring a DB connection.
    Useful for generating scripts to run against a managed DB.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ── Online mode ───────────────────────────────────────────────────────────────
def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine and run migrations via run_sync."""
    # Use the async URL so asyncpg is used for the migration connection.
    async_url = settings.ASYNC_DATABASE_URL

    connectable = async_engine_from_config(
        {"sqlalchemy.url": async_url, **config.get_section(config.config_ini_section, {})},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
