from __future__ import annotations

from typing import Any, Dict

from .schemas import AnalysisSnapshot
from .tool_adapters.capability_tools import ensure_area_data_readiness

_PRECHECK_BASE_TOOLS = {
    "read_current_scope",
    "read_current_results",
    "fetch_pois_in_scope",
    "compute_h3_metrics_from_scope_and_pois",
    "compute_population_overview_from_scope",
    "compute_nightlight_overview_from_scope",
    "compute_road_syntax_from_scope",
    "get_area_data_bundle",
}

_EXPLICIT_ANALYSIS_TOOLS = {
    "run_business_site_advice",
    "analyze_target_supply_gap_from_scope",
    "score_site_candidates",
}


def should_run_analysis_preflight(tool_name: str) -> bool:
    name = str(tool_name or "").strip()
    if not name or name in _PRECHECK_BASE_TOOLS:
        return False
    if name in _EXPLICIT_ANALYSIS_TOOLS:
        return True
    if name.startswith("analyze_"):
        return True
    if name.startswith("infer_"):
        return True
    if name.startswith("detect_"):
        return True
    if name.startswith("run_") and name.endswith("_pack"):
        return True
    if name.startswith("read_") and name.endswith("_analysis"):
        return True
    return False


async def ensure_preflight_for_analysis_tool(
    *,
    tool_name: str,
    snapshot: AnalysisSnapshot,
    artifacts: Dict[str, Any],
    question: str,
) -> Dict[str, Any]:
    if not should_run_analysis_preflight(tool_name):
        return {"applied": False}

    existing = artifacts.get("__analysis_preflight_state")
    if isinstance(existing, dict) and existing.get("ready"):
        return {
            "applied": False,
            "cached": True,
            "ready": True,
            "data_readiness": dict(existing.get("data_readiness") or {}),
        }

    readiness_payload = await ensure_area_data_readiness(
        arguments={},
        snapshot=snapshot,
        artifacts=artifacts,
        question=question,
    )
    data_readiness = dict(readiness_payload.get("data_readiness") or {})
    state = {
        "ready": bool(data_readiness.get("ready")),
        "data_readiness": data_readiness,
        "error": str(readiness_payload.get("error") or ""),
        "warnings": list(readiness_payload.get("warnings") or []),
        "fetched": list(data_readiness.get("fetched") or []),
        "reused": list(data_readiness.get("reused") or []),
    }
    merged_artifacts = readiness_payload.get("artifacts")
    if isinstance(merged_artifacts, dict):
        artifacts.update(merged_artifacts)
    artifacts["__analysis_preflight_state"] = state

    return {
        "applied": True,
        "ready": bool(state["ready"]),
        "error": state["error"],
        "warnings": list(state["warnings"]),
        "data_readiness": dict(state["data_readiness"]),
    }
