"""
Authentication & user-management service.
"""
from __future__ import annotations

import logging
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
UTC = timezone.utc
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from threading import Lock
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import AppException, AuthException, NotFoundException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    validate_password_complexity,
    verify_password,
)
from app.models.analytics import UserAnalytics
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    TokenResponse,
    UserUpdateRequest,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory password-reset token cache  {token -> (user_id, expires_at)}
# In production, replace with Redis using settings.REDIS_URL
# ---------------------------------------------------------------------------
_reset_tokens: dict[str, tuple[str, datetime]] = {}
_reset_lock = Lock()
_RESET_TOKEN_TTL_MINUTES = 30


def _purge_expired_reset_tokens() -> None:
    now = datetime.now(UTC)
    with _reset_lock:
        expired = [t for t, (_, exp) in _reset_tokens.items() if exp < now]
        for t in expired:
            del _reset_tokens[t]


class AuthService:
    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    async def register(self, db: AsyncSession, data: RegisterRequest) -> User:
        """Create a new user account and initialise their analytics row."""
        # Uniqueness checks
        existing_email = await self.get_user_by_email(db, str(data.email))
        if existing_email:
            raise AppException(
                detail="An account with that email already exists.",
                status_code=409,
                error_code="EMAIL_TAKEN",
            )

        result = await db.execute(select(User).where(User.username == data.username))
        if result.scalar_one_or_none():
            raise AppException(
                detail="That username is already taken.",
                status_code=409,
                error_code="USERNAME_TAKEN",
            )

        user = User(
            email=str(data.email),
            username=data.username,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
        )
        db.add(user)
        await db.flush()  # get user.id before creating analytics

        analytics = UserAnalytics(user_id=user.id)
        db.add(analytics)
        await db.commit()
        await db.refresh(user)
        logger.info("user_registered", extra={"user_id": str(user.id)})
        return user

    # ------------------------------------------------------------------
    # Login
    # ------------------------------------------------------------------
    async def login(self, db: AsyncSession, data: LoginRequest) -> TokenResponse:
        user = await self.get_user_by_email(db, str(data.email))
        if not user or not verify_password(data.password, user.hashed_password):
            raise AuthException(detail="Invalid email or password.")
        if not user.is_active:
            raise AuthException(detail="Account is deactivated.")

        user.last_login = datetime.now(UTC)
        await db.commit()

        return self._build_token_response(user)

    # ------------------------------------------------------------------
    # Token refresh
    # ------------------------------------------------------------------
    async def refresh_token(self, db: AsyncSession, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthException(detail="Invalid token type.")

        user = await self.get_user_by_id(db, payload.get("sub", ""))
        if not user or not user.is_active:
            raise AuthException(detail="User not found or inactive.")

        access_token = create_access_token({"sub": str(user.id)})
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,  # re-use existing refresh token
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    # ------------------------------------------------------------------
    # Forgot / reset password
    # ------------------------------------------------------------------
    async def forgot_password(self, db: AsyncSession, email: str) -> None:
        """Generate a reset token and send email (or log if SMTP unconfigured)."""
        user = await self.get_user_by_email(db, email)
        if not user:
            # Do not leak whether the email exists
            return

        _purge_expired_reset_tokens()
        token = str(uuid.uuid4())
        expires = datetime.now(UTC) + timedelta(minutes=_RESET_TOKEN_TTL_MINUTES)
        with _reset_lock:
            _reset_tokens[token] = (str(user.id), expires)

        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        self._send_reset_email(user.email, reset_link)
        logger.info("password_reset_requested", extra={"user_id": str(user.id)})

    async def reset_password(self, db: AsyncSession, token: str, new_password: str) -> None:
        _purge_expired_reset_tokens()
        with _reset_lock:
            entry = _reset_tokens.get(token)
        if not entry or entry[1] < datetime.now(UTC):
            raise AppException(
                detail="Invalid or expired reset token.",
                status_code=400,
                error_code="INVALID_RESET_TOKEN",
            )

        validate_password_complexity(new_password)
        user = await self.get_user_by_id(db, entry[0])
        if not user:
            raise NotFoundException("User")

        user.hashed_password = hash_password(new_password)
        await db.commit()
        with _reset_lock:
            _reset_tokens.pop(token, None)
        logger.info("password_reset_completed", extra={"user_id": str(user.id)})

    # ------------------------------------------------------------------
    # Change password (authenticated)
    # ------------------------------------------------------------------
    async def change_password(
        self,
        db: AsyncSession,
        user: User,
        old_password: str,
        new_password: str,
    ) -> None:
        if not verify_password(old_password, user.hashed_password):
            raise AuthException(detail="Current password is incorrect.")
        validate_password_complexity(new_password)
        user.hashed_password = hash_password(new_password)
        await db.commit()
        logger.info("password_changed", extra={"user_id": str(user.id)})

    # ------------------------------------------------------------------
    # Profile update
    # ------------------------------------------------------------------
    async def update_profile(
        self, db: AsyncSession, user: User, data: UserUpdateRequest
    ) -> User:
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.bio is not None:
            user.bio = data.bio
        if data.avatar_url is not None:
            user.avatar_url = data.avatar_url
        await db.commit()
        await db.refresh(user)
        return user

    # ------------------------------------------------------------------
    # Lookups
    # ------------------------------------------------------------------
    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, db: AsyncSession, user_id: str) -> Optional[User]:
        try:
            # Normalise to canonical UUID string with dashes — the column is String(36)
            uid_str = str(uuid.UUID(user_id))
        except ValueError:
            return None
        result = await db.execute(select(User).where(User.id == uid_str))
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_token_response(self, user: User) -> TokenResponse:
        payload = {"sub": str(user.id)}
        return TokenResponse(
            access_token=create_access_token(payload),
            refresh_token=create_refresh_token(payload),
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    def _send_reset_email(self, to_email: str, reset_link: str) -> None:
        subject = "Study Buddy – Password Reset"
        body = (
            f"Hello,\n\n"
            f"You requested a password reset. Click the link below to set a new password.\n\n"
            f"{reset_link}\n\n"
            f"This link expires in {_RESET_TOKEN_TTL_MINUTES} minutes.\n\n"
            f"If you did not request this, please ignore this email.\n\n"
            f"– The Study Buddy Team"
        )

        if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
            logger.info(
                "password_reset_link_logged",
                extra={"to": to_email, "link": reset_link},
            )
            return

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM
            msg["To"] = to_email
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())
        except Exception as exc:
            logger.error("smtp_send_failed", extra={"error": str(exc)})
            # Never surface SMTP errors to the caller
