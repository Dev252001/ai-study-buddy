"""
Study Buddy – FastAPI application entry-point.
"""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, make_asgi_app
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import init_db
from app.core.exceptions import AppException
from app.core.logging import configure_logging, get_logger

# ── Logging ───────────────────────────────────────────────────────────────────
configure_logging()
logger = get_logger(__name__)

# ── Prometheus metrics ────────────────────────────────────────────────────────
REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status_code"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "path"],
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("startup", app=settings.APP_NAME, version=settings.APP_VERSION)
    await init_db()
    yield
    logger.info("shutdown", app=settings.APP_NAME)


# ── Application factory ───────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-Powered Study Buddy – backend API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── Rate limiter state + handler ──────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging + metrics middleware ──────────────────────────────────────
@app.middleware("http")
async def request_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id

    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)

    start = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    except Exception:  # pragma: no cover
        raise
    finally:
        duration = time.perf_counter() - start
        status_code = response.status_code if response is not None else 500
        REQUEST_COUNT.labels(request.method, request.url.path, status_code).inc()
        REQUEST_LATENCY.labels(request.method, request.url.path).observe(duration)
        if response is not None:
            response.headers["X-Request-ID"] = request_id


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_code": exc.error_code},
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    import json as _json

    def _make_serializable(obj):  # type: ignore[no-untyped-def]
        """Recursively convert anything not JSON-serializable to a string."""
        if isinstance(obj, bytes):
            return obj.decode("utf-8", errors="replace")
        if isinstance(obj, dict):
            return {str(k): _make_serializable(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [_make_serializable(i) for i in obj]
        # Drop anything json still can't handle
        try:
            _json.dumps(obj)
            return obj
        except (TypeError, ValueError):
            return str(obj)

    safe_errors = _make_serializable(exc.errors())
    body = _json.dumps({"detail": safe_errors, "error_code": "VALIDATION_ERROR"})
    from starlette.responses import Response
    return Response(
        content=body,
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        media_type="application/json",
        headers={"X-Request-ID": getattr(request.state, "request_id", "")},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    import traceback

    traceback.print_exc()

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc),
            "error_type": type(exc).__name__,
            "error_code": "INTERNAL_ERROR",
        },
        headers={
            "X-Request-ID": getattr(request.state, "request_id", "")
        },
    )


# ── Prometheus metrics endpoint ───────────────────────────────────────────────
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# ── Routers ───────────────────────────────────────────────────────────────────
# Import deferred so models are loaded after DB engine is set up.
def _register_routers() -> None:
    from app.api.v1.routers import (  # noqa: PLC0415
        analytics,
        auth,
        chat,
        documents,
        export,
        flashcards,
        health,
        quiz,
        search,
        summaries,
    )

    prefix = "/api/v1"
    app.include_router(health.router, prefix=f"{prefix}/health", tags=["Health"])
    app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Auth"])
    app.include_router(documents.router, prefix=f"{prefix}/documents", tags=["Documents"])
    app.include_router(chat.router, prefix=f"{prefix}/chat", tags=["Chat"])
    app.include_router(quiz.router, prefix=f"{prefix}/quiz", tags=["Quiz"])
    app.include_router(flashcards.router, prefix=f"{prefix}/flashcards", tags=["Flashcards"])
    app.include_router(summaries.router, prefix=f"{prefix}/summaries", tags=["Summaries & AI"])
    app.include_router(search.router, prefix=f"{prefix}/search", tags=["Search"])
    app.include_router(analytics.router, prefix=f"{prefix}/analytics", tags=["Analytics"])
    app.include_router(export.router, prefix=f"{prefix}/export", tags=["Export"])


_register_routers()


# ── Custom OpenAPI schema (JWT Bearer) ────────────────────────────────────────
def custom_openapi() -> dict:  # type: ignore[return]
    if app.openapi_schema:
        return app.openapi_schema  # type: ignore[return-value]

    schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    schema.setdefault("components", {}).setdefault("securitySchemes", {})["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            if isinstance(operation, dict):
                operation.setdefault("security", [{"BearerAuth": []}])

    app.openapi_schema = schema
    return app.openapi_schema


app.openapi = custom_openapi  # type: ignore[method-assign]
