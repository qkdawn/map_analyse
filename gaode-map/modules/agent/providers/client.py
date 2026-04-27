from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol

import httpx

from core.config import settings


@dataclass(frozen=True)
class LLMProviderSpec:
    name: str
    supports_json_mode: bool = True
    supports_text_mode: bool = True


class LLMProviderClient(Protocol):
    @property
    def supports_json_mode(self) -> bool: ...

    async def chat_json(
        self,
        *,
        system_prompt: str,
        user_payload: Dict[str, Any],
        emit=None,
        phase: str = "",
        title: str = "",
        reasoning_id: str = "",
    ) -> Dict[str, Any]: ...

    async def chat_text(
        self,
        *,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
    ) -> str: ...

    async def health(self) -> bool: ...


LLM_PROVIDER_REGISTRY: Dict[str, LLMProviderSpec] = {
    "deepseek": LLMProviderSpec(name="deepseek", supports_json_mode=True, supports_text_mode=True),
    "openai_compatible": LLMProviderSpec(name="openai_compatible", supports_json_mode=True, supports_text_mode=True),
}


def normalize_provider_name(value: Any) -> str:
    return str(value or "").strip().lower()


def get_llm_provider_spec(provider: Optional[str] = None) -> Optional[LLMProviderSpec]:
    name = normalize_provider_name(provider if provider is not None else settings.ai_provider)
    if not name:
        return None
    return LLM_PROVIDER_REGISTRY.get(name)


def has_llm_base_config() -> bool:
    return bool(
        str(settings.ai_base_url or "").strip()
        and str(settings.ai_api_key or "").strip()
        and str(settings.ai_model or "").strip()
    )


def is_llm_enabled() -> bool:
    return bool(settings.ai_enabled and get_llm_provider_spec() and has_llm_base_config())


class OpenAICompatibleProviderClient:
    def __init__(self, spec: LLMProviderSpec):
        self.spec = spec

    @property
    def supports_json_mode(self) -> bool:
        return bool(self.spec.supports_json_mode)

    async def chat_json(
        self,
        *,
        system_prompt: str,
        user_payload: Dict[str, Any],
        emit=None,
        phase: str = "",
        title: str = "",
        reasoning_id: str = "",
    ) -> Dict[str, Any]:
        from .llm_provider import _invoke_json_role

        return await _invoke_json_role(
            system_prompt=system_prompt,
            user_payload=user_payload,
            emit=emit,
            phase=phase,
            title=title,
            reasoning_id=reasoning_id,
        )

    async def chat_text(self, *, messages: List[Dict[str, str]], temperature: float = 0.2) -> str:
        from .chat_parser import extract_chat_completion_text
        from .llm_provider import _stream_chat_completion

        base_url = str(settings.ai_base_url or "").rstrip("/")
        api_key = str(settings.ai_api_key or "")
        model = str(settings.ai_model or "").strip()
        if not (base_url and api_key and model):
            raise ValueError("llm_provider_not_configured")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        body: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": float(temperature),
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=float(settings.ai_timeout_s or 60)) as client:
            payload = await _stream_chat_completion(client=client, base_url=base_url, headers=headers, request_body=body)
        return extract_chat_completion_text(payload)

    async def health(self) -> bool:
        base_url = str(settings.ai_base_url or "").rstrip("/")
        api_key = str(settings.ai_api_key or "")
        if not (base_url and api_key):
            return False
        headers = {"Authorization": f"Bearer {api_key}"}
        try:
            async with httpx.AsyncClient(timeout=float(settings.ai_timeout_s or 15)) as client:
                response = await client.get(f"{base_url}/models", headers=headers)
            return 200 <= response.status_code < 300
        except Exception:
            return False


def get_llm_provider_client(provider: Optional[str] = None) -> Optional[LLMProviderClient]:
    spec = get_llm_provider_spec(provider)
    if not spec:
        return None
    if spec.name in {"deepseek", "openai_compatible"}:
        return OpenAICompatibleProviderClient(spec)
    return None
