from __future__ import annotations

from typing import Iterable

from .schemas import GovernanceMode, ToolSpec


def check_tool_governance(
    *,
    mode: GovernanceMode,
    spec: ToolSpec,
    confirmed_tools: Iterable[str] | None = None,
) -> str | None:
    confirmed = {str(item).strip() for item in (confirmed_tools or []) if str(item).strip()}
    if mode == "readonly" and not spec.readonly:
        return f"当前为 readonly 模式，工具 `{spec.name}` 不允许执行。"
    if mode == "guarded":
        needs_confirmation = spec.cost_level == "expensive" or spec.risk_level in {"guarded", "expensive"}
        if needs_confirmation and spec.name not in confirmed:
            return f"工具 `{spec.name}` 属于高成本或受控执行，请确认后重试。"
    return None
