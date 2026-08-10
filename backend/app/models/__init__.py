"""
Models package – importing each sub-module registers its tables on Base.metadata.
"""
from app.models.analytics import StudySession, UserAnalytics
from app.models.chat import ChatMessage, ChatSession
from app.models.document import Document, DocumentChunk
from app.models.flashcard import Flashcard, FlashcardSet
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.user import User

__all__ = [
    "User",
    "Document",
    "DocumentChunk",
    "ChatSession",
    "ChatMessage",
    "Quiz",
    "QuizQuestion",
    "QuizAttempt",
    "FlashcardSet",
    "Flashcard",
    "UserAnalytics",
    "StudySession",
]
