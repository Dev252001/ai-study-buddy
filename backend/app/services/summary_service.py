"""
Summary, concept-explanation, mind-map, study-plan, formula-sheet, and
glossary generation service.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AIServiceException
from app.schemas.summary import (
    ConceptExplainRequest,
    ConceptExplainResponse,
    SummaryRequest,
    SummaryResponse,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates per summary_type
# ---------------------------------------------------------------------------
_SUMMARY_SYSTEM_PROMPTS: dict[str, str] = {
    "short": (
        "You are a concise summariser. "
        "Write a 3-5 sentence overview of the provided text. "
        "Be clear and accurate. Respond in plain text only."
    ),
    "detailed": (
        "You are a thorough academic summariser. "
        "Write a comprehensive summary that covers all main topics, sub-topics, "
        "key definitions, and relationships found in the text. "
        "Use well-structured paragraphs. Respond in plain text only."
    ),
    "bullet": (
        "You are a concise note-taker. "
        "Extract the most important points from the text and present them "
        "as a bullet-point list. Each bullet should be one sentence. "
        "Respond with a plain bullet list only."
    ),
    "one_page": (
        "You are an expert study-note writer. "
        "Write one-page study notes from the text. Include: an overview paragraph, "
        "a 'Key Concepts' section, an 'Important Details' section, and a "
        "'Summary' paragraph. Keep it concise and exam-ready."
    ),
    "exam_revision": (
        "You are an exam preparation coach. "
        "Create focused exam revision notes from the text. Include: 'Must Know' facts, "
        "key definitions, common exam questions with brief answers, "
        "and any important formulas or dates. Be factual and precise."
    ),
}

_SUMMARY_USER_TEMPLATE = (
    "Please summarise the following document content:\n\n{context}"
)

_EXPLAIN_SYSTEM_PROMPTS: dict[str, str] = {
    "beginner": (
        "You are a patient teacher explaining to a young beginner with no prior knowledge. "
        "Use very simple words, short sentences, and relate everything to everyday life."
    ),
    "school": (
        "You are a high-school teacher. "
        "Use clear language appropriate for a teenage student with basic subject knowledge."
    ),
    "college": (
        "You are a university lecturer. "
        "Provide a thorough, technically accurate explanation appropriate for an undergraduate student."
    ),
    "advanced": (
        "You are an expert researcher. "
        "Provide a rigorous, technically detailed explanation assuming strong subject-matter expertise."
    ),
}

_EXPLAIN_USER_TEMPLATE = """
Explain the concept: "{concept}"
{context_block}
Your explanation must be structured as JSON with these exact keys:
  "explanation"      : main explanation text (thorough)
  "analogies"        : array of 1-3 analogy strings{analogies_hint}
  "examples"         : array of 1-3 concrete example strings{examples_hint}
  "related_concepts" : array of related concept names

Return only the JSON object, no markdown fences.
"""


def _extract_json_object(text: str) -> dict[str, Any]:
    text = re.sub(r"```(?:json)?", "", text).strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    return {}


def _extract_key_points(text: str) -> list[str]:
    """Heuristically extract bullet-like sentences as key points."""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    bullet_lines = [
        re.sub(r"^[\-\*\•\d\.]+\s*", "", ln)
        for ln in lines
        if re.match(r"^[\-\*\•\d\.]", ln)
    ]
    if bullet_lines:
        return bullet_lines[:15]
    # Fall back: use first 5 non-empty sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences[:5] if s.strip()]


class SummaryService:
    # ------------------------------------------------------------------
    # Summarise
    # ------------------------------------------------------------------
    async def generate_summary(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: SummaryRequest,
        rag_service,
    ) -> SummaryResponse:
        chunks = await rag_service.retrieve(
            query="main topics key concepts overview",
            document_ids=[str(request.document_id)],
            n_results=15,
        )
        if not chunks:
            raise AIServiceException("No content found in the specified document.")

        # Use up to ~8000 chars to stay within context limits
        context = "\n\n".join(c.content for c in chunks)[:8000]
        system_prompt = _SUMMARY_SYSTEM_PROMPTS[request.summary_type]
        user_prompt = _SUMMARY_USER_TEMPLATE.format(context=context)

        if request.max_words:
            user_prompt += f"\n\nPlease keep the summary under {request.max_words} words."

        summary_text = await rag_service._llm.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=2048,
            temperature=0.3,
        )

        key_points = _extract_key_points(summary_text)
        word_count = len(summary_text.split())

        return SummaryResponse(
            document_id=request.document_id,
            summary_type=request.summary_type,
            summary=summary_text,
            key_points=key_points,
            word_count=word_count,
        )

    # ------------------------------------------------------------------
    # Explain concept
    # ------------------------------------------------------------------
    async def explain_concept(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: ConceptExplainRequest,
        rag_service,
    ) -> ConceptExplainResponse:
        context_block = ""
        if request.document_id:
            chunks = await rag_service.retrieve(
                query=request.concept,
                document_ids=[str(request.document_id)],
                n_results=5,
            )
            if chunks:
                ctx = "\n\n".join(c.content for c in chunks)[:4000]
                context_block = f"\n\nUse this document context to inform your answer:\n{ctx}\n"

        analogies_hint = " (leave empty array if not helpful)" if not request.use_analogies else ""
        examples_hint = " (leave empty array if not helpful)" if not request.use_examples else ""

        prompt = _EXPLAIN_USER_TEMPLATE.format(
            concept=request.concept,
            context_block=context_block,
            analogies_hint=analogies_hint,
            examples_hint=examples_hint,
        )
        system_prompt = _EXPLAIN_SYSTEM_PROMPTS[request.level]

        raw = await rag_service._llm.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            max_tokens=1500,
            temperature=0.4,
        )

        data = _extract_json_object(raw)
        if not data:
            # Graceful fallback: treat entire response as explanation
            data = {"explanation": raw}

        analogies = data.get("analogies", []) if request.use_analogies else []
        return ConceptExplainResponse(
            concept=request.concept,
            explanation=data.get("explanation", raw),
            analogies=analogies,
            analogy=analogies[0] if analogies else None,
            examples=data.get("examples", []) if request.use_examples else [],
            related_concepts=data.get("related_concepts", []),
            level=request.level,
        )

    # ------------------------------------------------------------------
    # Mind map
    # ------------------------------------------------------------------
    async def generate_mind_map(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
        rag_service,
    ) -> dict:
        chunks = await rag_service.retrieve(
            query="main topics subtopics structure hierarchy",
            document_ids=[str(document_id)],
            n_results=12,
        )
        if not chunks:
            raise AIServiceException("No content found in the specified document.")

        context = "\n\n".join(c.content for c in chunks)[:6000]
        prompt = (
            "Create a hierarchical mind map from the following text.\n\n"
            "Return a JSON object with this structure:\n"
            '  {"topic": "Main Topic", "children": [{"topic": "...", "children": [...]}]}\n\n'
            "Use up to 3 levels of nesting. Return only the JSON, no prose.\n\n"
            f"Text:\n{context}"
        )

        raw = await rag_service._llm.generate(
            prompt=prompt,
            system_prompt="You are an expert at creating mind maps. Respond with valid JSON only.",
            max_tokens=2048,
            temperature=0.3,
        )

        data = _extract_json_object(raw)
        if not data:
            raise AIServiceException("LLM returned an unparseable mind map response.")
        return data

    # ------------------------------------------------------------------
    # Study plan
    # ------------------------------------------------------------------
    async def generate_study_plan(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
        exam_date: str,
        rag_service,
    ) -> dict:
        chunks = await rag_service.retrieve(
            query="topics chapters sections overview",
            document_ids=[str(document_id)],
            n_results=10,
        )
        if not chunks:
            raise AIServiceException("No content found in the specified document.")

        context = "\n\n".join(c.content for c in chunks)[:5000]
        prompt = (
            f"Create a structured study plan for a student preparing for an exam on {exam_date}.\n\n"
            "The plan should cover all the material in the provided text.\n"
            "Return a JSON object with this structure:\n"
            '  {"total_days": N, "daily_schedule": [{"day": 1, "date": "...", "topics": [...], "duration_hours": N, "tasks": [...]}]}\n\n'
            "Return only the JSON, no prose.\n\n"
            f"Study material overview:\n{context}"
        )

        raw = await rag_service._llm.generate(
            prompt=prompt,
            system_prompt="You are an expert academic planner. Respond with valid JSON only.",
            max_tokens=2048,
            temperature=0.3,
        )

        data = _extract_json_object(raw)
        if not data:
            raise AIServiceException("LLM returned an unparseable study plan response.")
        return data

    # ------------------------------------------------------------------
    # Formula sheet
    # ------------------------------------------------------------------
    async def generate_formula_sheet(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
        rag_service,
    ) -> dict:
        chunks = await rag_service.retrieve(
            query="formulas equations mathematical expressions variables constants",
            document_ids=[str(document_id)],
            n_results=15,
        )
        if not chunks:
            raise AIServiceException("No content found in the specified document.")

        context = "\n\n".join(c.content for c in chunks)[:6000]
        prompt = (
            "Extract all formulas, equations, and mathematical expressions from the text.\n\n"
            "Return a JSON object with this structure:\n"
            '  {"formulas": [{"name": "...", "formula": "...", "description": "...", "variables": {"var": "meaning"}}]}\n\n'
            "If there are no formulas, return {\"formulas\": []}.\n"
            "Return only the JSON, no prose.\n\n"
            f"Text:\n{context}"
        )

        raw = await rag_service._llm.generate(
            prompt=prompt,
            system_prompt="You are a mathematics and science expert. Respond with valid JSON only.",
            max_tokens=2048,
            temperature=0.2,
        )

        data = _extract_json_object(raw)
        if not data:
            raise AIServiceException("LLM returned an unparseable formula sheet response.")
        return data

    # ------------------------------------------------------------------
    # Glossary
    # ------------------------------------------------------------------
    async def generate_glossary(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
        rag_service,
    ) -> dict:
        chunks = await rag_service.retrieve(
            query="key terms definitions glossary vocabulary concepts",
            document_ids=[str(document_id)],
            n_results=15,
        )
        if not chunks:
            raise AIServiceException("No content found in the specified document.")

        context = "\n\n".join(c.content for c in chunks)[:6000]
        prompt = (
            "Extract all key terms and their definitions from the following text.\n\n"
            'Return a JSON object like: {"term1": "definition1", "term2": "definition2", ...}\n\n'
            "Include only domain-specific or important terms. Return only the JSON, no prose.\n\n"
            f"Text:\n{context}"
        )

        raw = await rag_service._llm.generate(
            prompt=prompt,
            system_prompt="You are an expert lexicographer. Respond with valid JSON only.",
            max_tokens=2048,
            temperature=0.2,
        )

        data = _extract_json_object(raw)
        if not data:
            raise AIServiceException("LLM returned an unparseable glossary response.")
        return data
