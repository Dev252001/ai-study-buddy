"""
Security utilities: password hashing, JWT creation/decoding.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

UTC = timezone.utc
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import AuthException

# ── Passlib context ───────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Password helpers ──────────────────────────────────────────────────────────
_PASSWORD_RE = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?]).{8,}$"
)


def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password*."""
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return _pwd_context.verify(plain, hashed)


def validate_password_complexity(password: str) -> None:
    """Raise ValueError if *password* does not meet complexity requirements."""
    if not _PASSWORD_RE.match(password):
        raise ValueError(
            "Password must be at least 8 characters and contain at least one uppercase letter, "
            "one lowercase letter, one digit, and one special character."
        )


# ── JWT helpers ───────────────────────────────────────────────────────────────
def _build_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["iat"] = datetime.now(UTC)
    payload["exp"] = datetime.now(UTC) + expires_delta
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """Create a short-lived access JWT."""
    delta = expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return _build_token({**data, "type": "access"}, delta)


def create_refresh_token(data: dict[str, Any]) -> str:
    """Create a long-lived refresh JWT."""
    delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return _build_token({**data, "type": "refresh"}, delta)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT.  Raises :class:`AuthException` on any failure.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as exc:
        raise AuthException(detail=f"Invalid or expired token: {exc}") from exc
