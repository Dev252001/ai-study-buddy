"""
structlog-based logging configuration.
"""
from __future__ import annotations

import io
import logging
import sys

import structlog

from app.core.config import settings

# Force stdout to UTF-8 on Windows to avoid cp1252 encoding errors
_stdout = sys.stdout
if hasattr(_stdout, "buffer"):
    _utf8_stdout = io.TextIOWrapper(_stdout.buffer, encoding="utf-8", line_buffering=True)
else:
    _utf8_stdout = _stdout  # type: ignore[assignment]


def configure_logging() -> None:
    """Configure structlog once at application startup."""

    # Wire structlog into stdlib so uvicorn / sqlalchemy logs flow through too
    logging.basicConfig(
        format="%(message)s",
        stream=_utf8_stdout,
        level=logging.DEBUG if settings.DEBUG else logging.INFO,
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.DEBUG:
        processors: list[structlog.types.Processor] = [
            *shared_processors,
            structlog.dev.ConsoleRenderer(),
        ]
    else:
        processors = [
            *shared_processors,
            structlog.processors.JSONRenderer(),
        ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if settings.DEBUG else logging.INFO
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=_utf8_stdout),
        cache_logger_on_first_use=True,
    )

    # Silence noisy loggers
    for name in ("uvicorn.access", "sqlalchemy.engine", "httpx", "httpcore"):
        logging.getLogger(name).setLevel(
            logging.DEBUG if settings.DEBUG else logging.WARNING
        )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger for *name*."""
    return structlog.get_logger(name)
