"""
Application-level exception hierarchy.
"""
from __future__ import annotations

from fastapi import status


class AppException(Exception):
    """Base class for all application exceptions."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    error_code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        detail: str = "An unexpected error occurred.",
        status_code: int | None = None,
        error_code: str | None = None,
    ) -> None:
        self.detail = detail
        if status_code is not None:
            self.status_code = status_code
        if error_code is not None:
            self.error_code = error_code
        super().__init__(detail)


class AuthException(AppException):
    """Authentication / authorisation failure."""

    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "AUTH_ERROR"

    def __init__(self, detail: str = "Authentication failed.") -> None:
        super().__init__(detail=detail)


class NotFoundException(AppException):
    """Resource not found."""

    status_code = status.HTTP_404_NOT_FOUND
    error_code = "NOT_FOUND"

    def __init__(self, resource: str = "Resource", resource_id: str | None = None) -> None:
        detail = f"{resource} not found."
        if resource_id:
            detail = f"{resource} '{resource_id}' not found."
        super().__init__(detail=detail)


class PermissionException(AppException):
    """Insufficient permissions."""

    status_code = status.HTTP_403_FORBIDDEN
    error_code = "PERMISSION_DENIED"

    def __init__(self, detail: str = "You do not have permission to perform this action.") -> None:
        super().__init__(detail=detail)


class DocumentProcessingException(AppException):
    """Error during document ingestion / processing pipeline."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "DOCUMENT_PROCESSING_ERROR"

    def __init__(self, detail: str = "Document processing failed.") -> None:
        super().__init__(detail=detail)


class AIServiceException(AppException):
    """Error communicating with an upstream AI/LLM service."""

    status_code = status.HTTP_502_BAD_GATEWAY
    error_code = "AI_SERVICE_ERROR"

    def __init__(self, detail: str = "AI service is unavailable or returned an error.") -> None:
        super().__init__(detail=detail)


class RateLimitException(AppException):
    """Client exceeded their request quota."""

    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    error_code = "RATE_LIMIT_EXCEEDED"

    def __init__(self, detail: str = "Rate limit exceeded. Please try again later.") -> None:
        super().__init__(detail=detail)
