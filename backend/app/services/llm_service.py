"""
LLM service – abstract base + provider implementations + factory.

Providers supported:
  - openai      → OpenAILLMService   (GPT-4o / GPT-4o-mini)
  - ibm_granite → IBMGraniteLLMService (watsonx.ai / Granite)
  - llama3      → OllamaLLMService   (Ollama local server)
  - mistral     → MistralLLMService  (Mistral AI cloud)
"""
from __future__ import annotations

import abc
import asyncio
import logging
from typing import Any, AsyncIterator

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings
from app.core.exceptions import AIServiceException

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------
class BaseLLMService(abc.ABC):
    @abc.abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """Return a complete text response."""

    @abc.abstractmethod
    async def stream_generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """Yield response tokens as they arrive."""


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------
class OpenAILLMService(BaseLLMService):
    def __init__(self, api_key: str = "", model: str = "") -> None:
        self._api_key = api_key or settings.OPENAI_API_KEY
        self._model = model or settings.OPENAI_MODEL

    def _client(self):  # type: ignore[return]
        from openai import AsyncOpenAI  # noqa: PLC0415
        return AsyncOpenAI(api_key=self._api_key)

    def _messages(self, prompt: str, system_prompt: str) -> list[dict[str, str]]:
        msgs: list[dict[str, str]] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.append({"role": "user", "content": prompt})
        return msgs

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        try:
            response = await self._client().chat.completions.create(
                model=self._model,
                messages=self._messages(prompt, system_prompt),
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.error("openai_generate_error", extra={"error": str(exc)})
            raise AIServiceException(f"OpenAI error: {exc}") from exc

    async def stream_generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        try:
            stream = await self._client().chat.completions.create(
                model=self._model,
                messages=self._messages(prompt, system_prompt),
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
        except Exception as exc:
            logger.error("openai_stream_error", extra={"error": str(exc)})
            raise AIServiceException(f"OpenAI stream error: {exc}") from exc


# ---------------------------------------------------------------------------
# IBM Granite via watsonx.ai
# ---------------------------------------------------------------------------
class IBMGraniteLLMService(BaseLLMService):
    _WML_URL = "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation"
    _TOKEN_URL = "https://iam.cloud.ibm.com/identity/token"

    def __init__(
        self,
        api_key: str = "",
        project_id: str = "",
        model_id: str = "",
    ) -> None:
        self._api_key = api_key or settings.IBM_API_KEY
        self._project_id = project_id or settings.IBM_PROJECT_ID
        self._model_id = model_id or settings.IBM_MODEL_ID
        self._access_token: str | None = None

    async def _get_access_token(self) -> str:
        if self._access_token:
            return self._access_token

        import httpx  # noqa: PLC0415

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                self._TOKEN_URL,
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey": self._api_key,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            self._access_token = resp.json()["access_token"]
            return self._access_token  # type: ignore[return-value]

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        import httpx  # noqa: PLC0415

        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        try:
            token = await self._get_access_token()
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    self._WML_URL,
                    json={
                        "model_id": self._model_id,
                        "input": full_prompt,
                        "parameters": {
                            "decoding_method": "greedy",
                            "max_new_tokens": max_tokens,
                            "temperature": temperature,
                        },
                        "project_id": self._project_id,
                    },
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["results"][0]["generated_text"]
        except Exception as exc:
            self._access_token = None  # force token refresh on next call
            logger.error("ibm_granite_error", extra={"error": str(exc)})
            raise AIServiceException(f"IBM Granite error: {exc}") from exc

    async def stream_generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        # IBM watsonx.ai streaming requires server-sent events; we fall back to
        # a single generate call and yield the full response as one chunk.
        result = await self.generate(prompt, system_prompt, max_tokens, temperature)
        yield result


# ---------------------------------------------------------------------------
# Ollama (llama3, mistral, etc. running locally)
# ---------------------------------------------------------------------------
class OllamaLLMService(BaseLLMService):
    def __init__(self, base_url: str = "", model: str = "") -> None:
        self._base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self._model = model or settings.OLLAMA_MODEL

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=5),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        import httpx  # noqa: PLC0415

        payload: dict[str, Any] = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(f"{self._base_url}/api/generate", json=payload)
                resp.raise_for_status()
                return resp.json().get("response", "")
        except Exception as exc:
            logger.error("ollama_generate_error", extra={"error": str(exc)})
            raise AIServiceException(f"Ollama error: {exc}") from exc

    async def stream_generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        import httpx  # noqa: PLC0415

        payload: dict[str, Any] = {
            "model": self._model,
            "prompt": prompt,
            "stream": True,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", f"{self._base_url}/api/generate", json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        import json  # noqa: PLC0415
                        try:
                            data = json.loads(line)
                            token = data.get("response", "")
                            if token:
                                yield token
                            if data.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue
        except Exception as exc:
            logger.error("ollama_stream_error", extra={"error": str(exc)})
            raise AIServiceException(f"Ollama stream error: {exc}") from exc


# ---------------------------------------------------------------------------
# Mistral AI
# ---------------------------------------------------------------------------
class MistralLLMService(BaseLLMService):
    _API_URL = "https://api.mistral.ai/v1/chat/completions"

    def __init__(self, api_key: str = "", model: str = "") -> None:
        self._api_key = api_key or settings.MISTRAL_API_KEY
        self._model = model or settings.MISTRAL_MODEL

    def _messages(self, prompt: str, system_prompt: str) -> list[dict[str, str]]:
        msgs: list[dict[str, str]] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.append({"role": "user", "content": prompt})
        return msgs

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        import httpx  # noqa: PLC0415

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    self._API_URL,
                    json={
                        "model": self._model,
                        "messages": self._messages(prompt, system_prompt),
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("mistral_generate_error", extra={"error": str(exc)})
            raise AIServiceException(f"Mistral error: {exc}") from exc

    async def stream_generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        import httpx  # noqa: PLC0415
        import json  # noqa: PLC0415

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    self._API_URL,
                    json={
                        "model": self._model,
                        "messages": self._messages(prompt, system_prompt),
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "stream": True,
                    },
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line or line == "data: [DONE]":
                            continue
                        if line.startswith("data: "):
                            try:
                                data = json.loads(line[6:])
                                delta = data["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yield delta
                            except (json.JSONDecodeError, KeyError):
                                continue
        except Exception as exc:
            logger.error("mistral_stream_error", extra={"error": str(exc)})
            raise AIServiceException(f"Mistral stream error: {exc}") from exc


# ---------------------------------------------------------------------------
# Groq  (OpenAI-compatible, free tier, very fast)
# ---------------------------------------------------------------------------
class GroqLLMService(BaseLLMService):
    _BASE_URL = "https://api.groq.com/openai/v1"

    def __init__(self, api_key: str = "", model: str = "") -> None:
        self._api_key = api_key or settings.GROQ_API_KEY
        self._model = model or settings.GROQ_MODEL

    def _messages(self, prompt: str, system_prompt: str) -> list[dict[str, str]]:
        msgs: list[dict[str, str]] = []
        if system_prompt:
            msgs.append({"role": "system", "content": system_prompt})
        msgs.append({"role": "user", "content": prompt})
        return msgs

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        import httpx  # noqa: PLC0415

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{self._BASE_URL}/chat/completions",
                    json={
                        "model": self._model,
                        "messages": self._messages(prompt, system_prompt),
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                    },
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("groq_generate_error", extra={"error": str(exc)})
            raise AIServiceException(f"Groq error: {exc}") from exc

    async def stream_generate(
        self,
        prompt: str,
        system_prompt: str = "",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        import httpx  # noqa: PLC0415
        import json as _json  # noqa: PLC0415

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                async with client.stream(
                    "POST",
                    f"{self._BASE_URL}/chat/completions",
                    json={
                        "model": self._model,
                        "messages": self._messages(prompt, system_prompt),
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "stream": True,
                    },
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if not line or line == "data: [DONE]":
                            continue
                        if line.startswith("data: "):
                            try:
                                data = _json.loads(line[6:])
                                delta = data["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yield delta
                            except (_json.JSONDecodeError, KeyError):
                                continue
        except Exception as exc:
            logger.error("groq_stream_error", extra={"error": str(exc)})
            raise AIServiceException(f"Groq stream error: {exc}") from exc


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
class LLMServiceFactory:
    @staticmethod
    def create(provider: str = "") -> BaseLLMService:
        p = (provider or settings.LLM_PROVIDER).lower()
        if p == "openai":
            return OpenAILLMService()
        if p == "groq":
            return GroqLLMService()
        if p == "ibm_granite":
            return IBMGraniteLLMService()
        if p in ("llama3", "ollama"):
            return OllamaLLMService()
        if p == "mistral":
            return MistralLLMService()
        raise ValueError(
            f"Unknown LLM provider '{p}'. "
            f"Valid options: openai, groq, ibm_granite, llama3, mistral."
        )


# Convenience alias used by deps.py
LLMService = LLMServiceFactory.create
