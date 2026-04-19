from __future__ import annotations

from typing import Any, Dict, List

from .schemas import (
    AgentSummaryGenerateResponse,
    AgentSummaryReadinessResponse,
    AgentSummaryRequest,
)
from .synthesizer import build_panel_payloads
from .tool_adapters.capability_tools import ensure_area_data_readiness

_DIMENSION_ORDER = ["poi", "h3", "population", "nightlight", "road"]
_DIMENSION_TO_TASK = {
    "poi": "poi_grid",
    "h3": "poi_grid",
    "population": "population",
    "nightlight": "nightlight",
    "road": "road_syntax",
}


def _normalize_data_readiness(payload: Dict[str, Any]) -> Dict[str, Any]:
    data_readiness = dict(payload.get("data_readiness") or {})
    reused = [str(item) for item in (data_readiness.get("reused") or []) if str(item).strip()]
    fetched = [str(item) for item in (data_readiness.get("fetched") or []) if str(item).strip()]
    completed_dimensions = {key for key in reused + fetched if key in _DIMENSION_ORDER}
    missing_dimensions = [key for key in _DIMENSION_ORDER if key not in completed_dimensions]
    missing_tasks: List[str] = []
    for dim in missing_dimensions:
        task_key = _DIMENSION_TO_TASK.get(dim)
        if task_key and task_key not in missing_tasks:
            missing_tasks.append(task_key)
    ready = bool(data_readiness.get("ready")) and not missing_tasks
    return {
        "checked": bool(data_readiness.get("checked")),
        "ready": ready,
        "missing_tasks": missing_tasks,
        "reused": reused,
        "fetched": fetched,
    }


async def evaluate_summary_readiness(payload: AgentSummaryRequest) -> AgentSummaryReadinessResponse:
    readiness_payload = await ensure_area_data_readiness(
        arguments={},
        snapshot=payload.analysis_snapshot,
        artifacts={},
        question="生成总结前检查数据就绪度",
    )
    normalized = _normalize_data_readiness(readiness_payload)
    return AgentSummaryReadinessResponse(
        data_readiness=normalized,
        error=str(readiness_payload.get("error") or ""),
        warnings=[str(item) for item in (readiness_payload.get("warnings") or []) if str(item).strip()],
        phases=["checked"],
    )


async def generate_summary_pack(payload: AgentSummaryRequest) -> AgentSummaryGenerateResponse:
    readiness_payload = await ensure_area_data_readiness(
        arguments={},
        snapshot=payload.analysis_snapshot,
        artifacts={},
        question="补齐数据并生成结构化总结",
    )
    normalized = _normalize_data_readiness(readiness_payload)
    warnings = [str(item) for item in (readiness_payload.get("warnings") or []) if str(item).strip()]
    error = str(readiness_payload.get("error") or "")
    phases = ["checked", "fetch_missing"]
    panel_payloads: Dict[str, Any] = {}
    summary_pack: Dict[str, Any] = {}
    if normalized["ready"]:
        artifacts = dict(readiness_payload.get("artifacts") or {})
        panel_payloads = build_panel_payloads("总结", payload.analysis_snapshot, artifacts)
        panel_payloads["data_readiness"] = dict(normalized)
        summary_pack = dict(panel_payloads.get("summary_pack") or {})
        phases.append("analysis_started")

    return AgentSummaryGenerateResponse(
        data_readiness=normalized,
        panel_payloads=panel_payloads,
        summary_pack=summary_pack,
        error=error,
        warnings=warnings,
        phases=phases,
    )

