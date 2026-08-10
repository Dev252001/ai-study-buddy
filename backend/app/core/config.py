"""
Application settings loaded from environment variables / .env file.
All fields are optional and ship with safe defaults so the app starts
without a fully-configured environment (useful for tests / CI).
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Study Buddy API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_OPENSSL_RAND_HEX_32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql://study_buddy:study_buddy@localhost:5432/study_buddy"
    # asyncpg variant – auto-derived if not set explicitly
    ASYNC_DATABASE_URL: str = ""

    @field_validator("ASYNC_DATABASE_URL", mode="before")
    @classmethod
    def derive_async_url(cls, v: str, info) -> str:  # type: ignore[no-untyped-def]
        if v:
            return v
        sync_url: str = info.data.get("DATABASE_URL", "")
        return sync_url.replace("postgresql://", "postgresql+asyncpg://", 1).replace(
            "postgres://", "postgresql+asyncpg://", 1
        )

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── ChromaDB ─────────────────────────────────────────────────────────────
    CHROMADB_HOST: str = "localhost"
    CHROMADB_PORT: int = 8000
    CHROMADB_COLLECTION_NAME: str = "study_buddy_vectors"

    # ── Embeddings ───────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # ── LLM provider ─────────────────────────────────────────────────────────
    LLM_PROVIDER: Literal["ibm_granite", "openai", "groq", "llama3", "mistral"] = "openai"

    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Groq (free tier — https://console.groq.com)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama3-8b-8192"

    # IBM WatsonX / Granite
    IBM_API_KEY: str = ""
    IBM_PROJECT_ID: str = ""
    IBM_MODEL_ID: str = "ibm/granite-13b-chat-v2"

    # Ollama (llama3)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # Mistral
    MISTRAL_API_KEY: str = ""
    MISTRAL_MODEL: str = "mistral-medium-latest"

    # ── File uploads ─────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    # Store as plain string; use the property below to get a list
    ALLOWED_EXTENSIONS: str = "pdf,docx,pptx,txt,md,png,jpg,jpeg"

    # ── OCR ──────────────────────────────────────────────────────────────────
    TESSERACT_CMD: str = "tesseract"

    # ── SMTP ─────────────────────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "no-reply@studybuddy.app"

    # ── Frontend ─────────────────────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Stored as plain string or JSON array string; parsed by property
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # ── Derived helpers ───────────────────────────────────────────────────────
    @property
    def allowed_extensions_list(self) -> list[str]:
        import json
        v = self.ALLOWED_EXTENSIONS.strip()
        if v.startswith("["):
            try:
                return json.loads(v)
            except Exception:
                pass
        return [ext.strip().lower() for ext in v.split(",") if ext.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        import json
        v = self.CORS_ORIGINS.strip()
        if v.startswith("["):
            try:
                return json.loads(v)
            except Exception:
                pass
        return [o.strip().strip('"').strip("'") for o in v.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


settings = Settings()
