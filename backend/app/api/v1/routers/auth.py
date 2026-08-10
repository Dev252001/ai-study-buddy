"""
Authentication router – /api/v1/auth
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.services.auth_service import AuthService

router = APIRouter()
_svc = AuthService()


# ── Register ──────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Create a new user account."""
    return await _svc.register(db, data)


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate and receive access + refresh tokens."""
    return await _svc.login(db, data)


# ── Refresh ───────────────────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a refresh token for a new access token."""
    return await _svc.refresh_token(db, data.refresh_token)


# ── Forgot password ───────────────────────────────────────────────────────────
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Request a password-reset email."""
    await _svc.forgot_password(db, str(data.email))
    return {"message": "If that email is registered, a reset link has been sent."}


# ── Reset password ────────────────────────────────────────────────────────────
@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Reset a password using a one-time token."""
    await _svc.reset_password(db, data.token, data.new_password)
    return {"message": "Password has been reset successfully."}


# ── Get current user ──────────────────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)) -> User:
    """Return the authenticated user's profile."""
    return current_user


# ── Update profile ────────────────────────────────────────────────────────────
@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update the authenticated user's profile fields."""
    return await _svc.update_profile(db, current_user, data)


# ── Change password ───────────────────────────────────────────────────────────
@router.post("/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Change password for the currently authenticated user."""
    await _svc.change_password(db, current_user, data.current_password, data.new_password)
    return {"message": "Password changed successfully."}


# ── Logout ────────────────────────────────────────────────────────────────────
@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    current_user: User = Depends(get_current_active_user),
) -> dict[str, str]:
    """
    Stateless logout – client must discard tokens.
    Token blocklist / Redis invalidation can be added here.
    """
    return {"message": "Logged out successfully."}
