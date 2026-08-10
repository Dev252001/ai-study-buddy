"""
Quiz generation, retrieval, and attempt-grading service.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import datetime, timezone
UTC = timezone.utc
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AIServiceException, NotFoundException, PermissionException
from app.models.analytics import StudySession, UserAnalytics
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.schemas.quiz import QuizAttemptRequest, QuizAttemptResponse, QuizGenerateRequest, QuizQuestionWithAnswerResponse

logger = logging.getLogger(__name__)

_QUIZ_SYSTEM_PROMPT = (
    "You are an expert educator who creates high-quality quiz questions. "
    "You always respond with valid JSON only — no markdown fences, no prose."
)

_QUIZ_PROMPT_TEMPLATE = """
Generate exactly {num_questions} quiz questions from the provided study material.

Requirements:
- Type: {quiz_type}
- Difficulty: {difficulty}
{topic_hint}

For each question return a JSON object with these keys:
  "question"       : the question text
  "type"           : "{quiz_type}"
  "options"        : array of 4 answer strings (required for mcq/true_false, null otherwise)
  "correct_answer" : the verbatim correct answer (must match one of options for mcq/true_false)
  "explanation"    : a 1-2 sentence explanation of why the answer is correct

Return a JSON array of exactly {num_questions} such objects and nothing else.

Study material:
{context}
"""


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    """Robustly extract the first JSON array found in *text*."""
    # Strip markdown fences if present
    text = re.sub(r"```(?:json)?", "", text).strip()

    # Try direct parse first
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    # Find first [...] block
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass

    return []


class QuizService:
    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------
    async def generate_quiz(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: QuizGenerateRequest,
        rag_service,
    ) -> Quiz:
        # Retrieve relevant chunks from document
        chunks = await rag_service.retrieve(
            query=f"key concepts topics questions {' '.join(request.topics or [])}",
            document_ids=[str(request.document_id)],
            n_results=12,
        )
        if not chunks:
            raise AIServiceException("No content found in the specified document.")

        context = "\n\n".join(c.content for c in chunks[:10])
        topic_hint = (
            f"- Focus on these topics: {', '.join(request.topics)}"
            if request.topics
            else ""
        )

        prompt = _QUIZ_PROMPT_TEMPLATE.format(
            num_questions=request.num_questions,
            quiz_type=request.quiz_type,
            difficulty=request.difficulty,
            topic_hint=topic_hint,
            context=context,
        )

        raw = await rag_service._llm.generate(
            prompt=prompt,
            system_prompt=_QUIZ_SYSTEM_PROMPT,
            max_tokens=4096,
            temperature=0.4,
        )

        questions_data = _extract_json_array(raw)
        if not questions_data:
            logger.error("quiz_json_parse_failed", extra={"raw": raw[:500]})
            raise AIServiceException("LLM returned an unparseable quiz response.")

        # Determine title
        title = request.title or f"{request.quiz_type.upper()} Quiz — {chunks[0].document_title}"

        quiz = Quiz(
            user_id=str(user_id),
            document_id=str(request.document_id),
            title=title,
            quiz_type=request.quiz_type,
            difficulty=request.difficulty,
            total_questions=len(questions_data),
        )
        db.add(quiz)
        await db.flush()

        for idx, q in enumerate(questions_data):
            question = QuizQuestion(
                quiz_id=quiz.id,
                question_text=str(q.get("question", "")),
                question_type=str(q.get("type", request.quiz_type)),
                options=q.get("options"),
                correct_answer=str(q.get("correct_answer", "")),
                explanation=q.get("explanation"),
                order_index=idx,
            )
            db.add(question)

        await db.commit()
        await db.refresh(quiz)

        result = await db.execute(
            select(Quiz)
            .options(selectinload(Quiz.questions))
            .where(Quiz.id == quiz.id)
        )
        return result.scalar_one()

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    async def get_quiz(self, db: AsyncSession, quiz_id: uuid.UUID, user_id: uuid.UUID) -> Quiz:
        result = await db.execute(
            select(Quiz)
            .options(selectinload(Quiz.questions))
            .where(Quiz.id == str(quiz_id))
        )
        quiz = result.scalar_one_or_none()
        if not quiz:
            raise NotFoundException("Quiz", str(quiz_id))
        if str(quiz.user_id) != str(user_id):
            raise PermissionException()
        return quiz

    async def list_quizzes(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20,
    ) -> list[Quiz]:
        result = await db.execute(
            select(Quiz)
            .options(selectinload(Quiz.questions))
            .where(Quiz.user_id == str(user_id))
            .order_by(Quiz.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def delete_quiz(self, db: AsyncSession, quiz_id: uuid.UUID, user_id: uuid.UUID) -> None:
        quiz = await self.get_quiz(db, quiz_id, user_id)
        await db.delete(quiz)
        await db.commit()

    # ------------------------------------------------------------------
    # Attempt grading
    # ------------------------------------------------------------------
    async def submit_attempt(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: QuizAttemptRequest,
    ) -> QuizAttemptResponse:
        quiz = await self.get_quiz(db, request.quiz_id, user_id)

        correct_count = 0
        feedback: list[QuizQuestionWithAnswerResponse] = []

        for question in quiz.questions:
            q_id = str(question.id)
            user_answer = request.answers.get(q_id, "")
            is_correct = user_answer.strip().lower() == question.correct_answer.strip().lower()
            if is_correct:
                correct_count += 1
            feedback.append(
                QuizQuestionWithAnswerResponse(
                    id=question.id,
                    question_text=question.question_text,
                    question_type=question.question_type,
                    options=question.options,
                    order_index=question.order_index,
                    correct_answer=question.correct_answer,
                    explanation=question.explanation,
                    is_correct=is_correct,
                    user_answer=user_answer,
                )
            )

        total = len(quiz.questions)
        max_score = float(total)
        score = float(correct_count)
        percentage = round((score / max_score * 100) if max_score > 0 else 0.0, 2)

        attempt = QuizAttempt(
            quiz_id=quiz.id,
            user_id=str(user_id),
            answers=request.answers,
            score=score,
            max_score=max_score,
            percentage=percentage,
            time_taken_seconds=request.time_taken_seconds,
        )
        db.add(attempt)
        await db.flush()

        # Update analytics + streak
        await self._update_analytics(db, user_id, percentage)
        from app.services.analytics_service import AnalyticsService  # noqa: PLC0415
        await AnalyticsService().update_streak(db, user_id)
        await db.commit()
        await db.refresh(attempt)

        return QuizAttemptResponse(
            attempt_id=attempt.id,
            quiz_id=quiz.id,
            score=score,
            max_score=max_score,
            percentage=percentage,
            correct=correct_count,
            incorrect=total - correct_count,
            time_taken_seconds=attempt.time_taken_seconds,
            completed_at=attempt.completed_at,
            feedback=feedback,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    async def _update_analytics(
        self, db: AsyncSession, user_id: uuid.UUID, new_percentage: float
    ) -> None:
        result = await db.execute(
            select(UserAnalytics).where(UserAnalytics.user_id == str(user_id))
        )
        analytics = result.scalar_one_or_none()
        if not analytics:
            return

        taken = analytics.total_quizzes_taken
        prev_avg = analytics.avg_quiz_score
        analytics.total_quizzes_taken = taken + 1
        analytics.avg_quiz_score = round(
            (prev_avg * taken + new_percentage) / (taken + 1), 2
        )
        # Credit 5 minutes per quiz attempt as study time
        analytics.total_study_hours = round(analytics.total_study_hours + 5 / 60, 4)
        now = datetime.now(UTC)
        analytics.last_active = now
        db.add(StudySession(
            user_id=str(user_id),
            activity_type="quiz",
            started_at=now,
            ended_at=now,
            duration_minutes=5,
        ))
        await db.flush()
