from __future__ import annotations

import math
from numbers import Real
from typing import Any, Dict, List

from .analysis_extractors import (
    analyze_poi_mix,
    build_h3_structure_analysis,
    build_nightlight_pattern_analysis,
    build_poi_structure_analysis,
    build_population_profile_analysis,
    build_road_pattern_analysis,
    infer_area_character_labels,
    is_h3_structure_ready,
    is_nightlight_pattern_ready,
    is_poi_structure_ready,
    is_population_profile_ready,
    is_road_pattern_ready,
)
from .schemas import (
    AgentSummaryGenerateResponse,
    AgentSummaryProgressStep,
    AgentSummaryReadinessResponse,
    AgentSummaryRequest,
)
from .providers.llm_provider import _invoke_json_role, is_llm_enabled
from .synthesizer import build_citations, build_summary_panel_payloads
from .tool_adapters.capability_tools import ensure_area_data_readiness
from .tool_adapters.scenario_tools import run_area_character_pack

_DIMENSION_ORDER = ["poi", "h3", "population", "nightlight", "road"]
_DIMENSION_TO_TASK = {
    "poi": "poi_grid",
    "h3": "poi_grid",
    "population": "population",
    "nightlight": "nightlight",
    "road": "road_syntax",
}
_STRUCTURED_TASK_ORDER = ["poi_structure", "spatial_structure", "area_labels"]
_PHASE_ORDER = ["precheck", "fetch_missing", "derive_analysis", "analysis_started"]


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, Real):
        number = float(value)
        if not math.isfinite(number):
            return None
        if number.is_integer():
            return int(number)
        return number
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    return str(value)


def _build_progress_steps(phases: List[str], *, failed: bool = False) -> List[AgentSummaryProgressStep]:
    completed = set(phases or [])
    active = ""
    for phase in reversed(_PHASE_ORDER):
        if phase in completed:
            active = phase
            break
    steps: List[AgentSummaryProgressStep] = []
    for phase in _PHASE_ORDER:
        status = "pending"
        if phase in completed:
            status = "completed"
        elif active and _PHASE_ORDER.index(phase) == _PHASE_ORDER.index(active) + 1:
            status = "running"
        steps.append(AgentSummaryProgressStep(key=phase, label=phase, status=status))
    if failed and steps:
        # mark current running step failed; if none running, fail the last completed phase
        running_index = next((idx for idx, item in enumerate(steps) if item.status == "running"), -1)
        if running_index >= 0:
            steps[running_index].status = "failed"
        else:
            completed_index = max((idx for idx, item in enumerate(steps) if item.status == "completed"), default=-1)
            if completed_index >= 0:
                steps[completed_index].status = "failed"
    return steps


def _derive_structured_status(snapshot: Any, artifacts: Dict[str, Any]) -> Dict[str, Any]:
    poi_structure = (
        dict(artifacts.get("current_poi_structure_analysis") or {})
        if isinstance(artifacts.get("current_poi_structure_analysis"), dict)
        else build_poi_structure_analysis(snapshot, artifacts)
    )
    h3_structure = (
        dict(artifacts.get("current_h3_structure_analysis") or {})
        if isinstance(artifacts.get("current_h3_structure_analysis"), dict)
        else build_h3_structure_analysis(snapshot, artifacts)
    )
    population_profile = (
        dict(artifacts.get("current_population_profile_analysis") or {})
        if isinstance(artifacts.get("current_population_profile_analysis"), dict)
        else build_population_profile_analysis(snapshot, artifacts)
    )
    nightlight_pattern = (
        dict(artifacts.get("current_nightlight_pattern_analysis") or {})
        if isinstance(artifacts.get("current_nightlight_pattern_analysis"), dict)
        else build_nightlight_pattern_analysis(snapshot, artifacts)
    )
    road_pattern = (
        dict(artifacts.get("current_road_pattern_analysis") or {})
        if isinstance(artifacts.get("current_road_pattern_analysis"), dict)
        else build_road_pattern_analysis(snapshot, artifacts)
    )
    business_profile = (
        dict(artifacts.get("current_business_profile") or {})
        if isinstance(artifacts.get("current_business_profile"), dict)
        else analyze_poi_mix(snapshot, artifacts, poi_structure=poi_structure)
    )
    area_labels = (
        dict(artifacts.get("current_area_character_labels") or {})
        if isinstance(artifacts.get("current_area_character_labels"), dict)
        else infer_area_character_labels(
            snapshot,
            artifacts,
            poi_structure=poi_structure,
            business_profile=business_profile,
            population_profile=population_profile,
            nightlight_pattern=nightlight_pattern,
            road_pattern=road_pattern,
        )
    )

    missing_tasks: List[str] = []
    if not is_poi_structure_ready(poi_structure):
        missing_tasks.append("poi_structure")
    if not (
        is_h3_structure_ready(h3_structure)
        and is_population_profile_ready(population_profile)
        and is_nightlight_pattern_ready(nightlight_pattern)
        and is_road_pattern_ready(road_pattern)
    ):
        missing_tasks.append("spatial_structure")
    if not bool((area_labels.get("character_tags") or [])):
        missing_tasks.append("area_labels")

    return {
        "missing_tasks": missing_tasks,
        "artifacts": {
            "current_poi_structure_analysis": poi_structure,
            "current_h3_structure_analysis": h3_structure,
            "current_population_profile_analysis": population_profile,
            "current_nightlight_pattern_analysis": nightlight_pattern,
            "current_road_pattern_analysis": road_pattern,
            "current_business_profile": business_profile,
            "current_area_character_labels": area_labels,
        },
    }


def _normalize_data_readiness(
    payload: Dict[str, Any],
    *,
    structured_missing_tasks: List[str] | None = None,
    extra_fetched: List[str] | None = None,
    extra_reused: List[str] | None = None,
) -> Dict[str, Any]:
    data_readiness = dict(payload.get("data_readiness") or {})
    reused = [str(item) for item in (data_readiness.get("reused") or []) if str(item).strip()]
    fetched = [str(item) for item in (data_readiness.get("fetched") or []) if str(item).strip()]
    for item in (extra_reused or []):
        text = str(item).strip()
        if text and text not in reused:
            reused.append(text)
    for item in (extra_fetched or []):
        text = str(item).strip()
        if text and text not in fetched:
            fetched.append(text)
    completed_dimensions = {key for key in reused + fetched if key in _DIMENSION_ORDER}
    missing_dimensions = [key for key in _DIMENSION_ORDER if key not in completed_dimensions]
    missing_tasks: List[str] = []
    for dim in missing_dimensions:
        task_key = _DIMENSION_TO_TASK.get(dim)
        if task_key and task_key not in missing_tasks:
            missing_tasks.append(task_key)
    for task in (structured_missing_tasks or []):
        task_key = str(task).strip()
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


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _top_poi_mix(snapshot: Any) -> List[Dict[str, Any]]:
    frontend = snapshot.frontend_analysis if isinstance(snapshot.frontend_analysis, dict) else {}
    poi_panel = frontend.get("poi") if isinstance(frontend.get("poi"), dict) else {}
    category_stats = poi_panel.get("category_stats") if isinstance(poi_panel.get("category_stats"), dict) else {}
    labels = [str(item).strip() for item in (category_stats.get("labels") or []) if str(item).strip()]
    values: List[float] = []
    for item in category_stats.get("values") or []:
        try:
            values.append(float(item))
        except (TypeError, ValueError):
            values.append(0.0)
    total = sum(value for value in values if value > 0)
    pairs: List[Dict[str, Any]] = []
    for index, label in enumerate(labels):
        value = values[index] if index < len(values) else 0.0
        if value <= 0:
            continue
        ratio = round(value / total, 4) if total > 0 else 0.0
        pairs.append({"label": label, "count": int(round(value)), "ratio": ratio})
    pairs.sort(key=lambda item: item["count"], reverse=True)
    return pairs[:5]


def _derive_icsc_tags(snapshot: Any, artifacts: Dict[str, Any]) -> List[str]:
    business_profile = artifacts.get("current_business_profile") if isinstance(artifacts.get("current_business_profile"), dict) else {}
    poi_structure = artifacts.get("current_poi_structure_analysis") if isinstance(artifacts.get("current_poi_structure_analysis"), dict) else {}
    raw_tags = business_profile.get("business_types")
    if not isinstance(raw_tags, list):
        raw_tags = poi_structure.get("structure_tags")
    tags: List[str] = []
    for item in raw_tags or []:
        text = str(item).strip()
        if text and text not in tags:
            tags.append(text)
    return tags[:6]


def _summary_pack_system_prompt() -> str:
    return (
        "你是 gaode-map 的商业总结撰写器。"
        "你只负责把已给定的结构化证据整理成商业判断，不得创造新的事实。"
        "必须只输出 JSON，不要输出 markdown。"
        "JSON 结构固定为："
        "{\"headline_judgment\":{\"summary\":\"...\",\"supporting_clause\":\"...\"},"
        "\"secondary_conclusions\":[{\"title\":\"...\",\"reasoning\":\"...\"}],"
        "\"user_profile\":{\"headline\":\"...\",\"traits\":[\"...\"]},"
        "\"behavior_inference\":{\"headline\":\"...\",\"traits\":[\"...\"]}}"
        "规则："
        "1. headline_judgment.summary 必须是一句话商业判断，直接回答这个区域是什么级别或类型的商业。"
        "2. 不要把原始指标、百分比、样本量直接写成主句；不要做数据播报。"
        "3. secondary_conclusions 必须输出 2 到 4 条，每条都要写“判断 + 含义”，不能只列指标。"
        "4. user_profile 必须写消费者是谁，不能写成区域类型或商业区描述。"
        "5. behavior_inference 必须写消费行为、频次、时段或跨区吸引力，不能重复 user_profile 或 headline_judgment。"
        "6. 如果证据不足，也只能基于已给证据做保守判断，不能虚构。"
        "7. 不要输出 ICSC 标签，这部分会由系统注入。"
    )


def _build_summary_llm_payload(snapshot: Any, artifacts: Dict[str, Any]) -> Dict[str, Any]:
    poi_structure = artifacts.get("current_poi_structure_analysis") if isinstance(artifacts.get("current_poi_structure_analysis"), dict) else {}
    h3_structure = artifacts.get("current_h3_structure_analysis") if isinstance(artifacts.get("current_h3_structure_analysis"), dict) else {}
    population_profile = artifacts.get("current_population_profile_analysis") if isinstance(artifacts.get("current_population_profile_analysis"), dict) else {}
    nightlight_pattern = artifacts.get("current_nightlight_pattern_analysis") if isinstance(artifacts.get("current_nightlight_pattern_analysis"), dict) else {}
    road_pattern = artifacts.get("current_road_pattern_analysis") if isinstance(artifacts.get("current_road_pattern_analysis"), dict) else {}
    business_profile = artifacts.get("current_business_profile") if isinstance(artifacts.get("current_business_profile"), dict) else {}
    area_labels = artifacts.get("current_area_character_labels") if isinstance(artifacts.get("current_area_character_labels"), dict) else {}
    commercial_hotspots = artifacts.get("current_commercial_hotspots") if isinstance(artifacts.get("current_commercial_hotspots"), dict) else {}
    return {
        "task": "summary_pack_generation",
        "business_profile": {
            "label": _clean_text(business_profile.get("business_profile")),
            "portrait": _clean_text(business_profile.get("portrait")),
            "summary_text": _clean_text(business_profile.get("summary_text")),
            "functional_mix_score": business_profile.get("functional_mix_score"),
        },
        "poi_structure": {
            "summary_text": _clean_text(poi_structure.get("summary_text")),
            "dominant_categories": list(poi_structure.get("dominant_categories") or []),
            "structure_tags": list(poi_structure.get("structure_tags") or []),
            "top_category_mix": _top_poi_mix(snapshot),
        },
        "spatial_structure": {
            "distribution_pattern": _clean_text(h3_structure.get("distribution_pattern")),
            "summary_text": _clean_text(h3_structure.get("summary_text")),
            "hotspot_mode": _clean_text(commercial_hotspots.get("hotspot_mode")),
            "hotspot_summary": _clean_text(commercial_hotspots.get("summary_text")),
            "core_zone_count": commercial_hotspots.get("core_zone_count"),
            "opportunity_zone_count": commercial_hotspots.get("opportunity_zone_count"),
        },
        "population_profile": {
            "summary_text": _clean_text(population_profile.get("summary_text")),
            "total_population": population_profile.get("total_population"),
            "top_age_band": _clean_text(population_profile.get("top_age_band")),
        },
        "nightlight_pattern": {
            "summary_text": _clean_text(nightlight_pattern.get("summary_text")),
            "total_radiance": nightlight_pattern.get("total_radiance"),
            "core_hotspot_count": nightlight_pattern.get("core_hotspot_count"),
        },
        "road_pattern": {
            "summary_text": _clean_text(road_pattern.get("summary_text")),
            "node_count": road_pattern.get("node_count"),
            "edge_count": road_pattern.get("edge_count"),
            "regression_r2": road_pattern.get("regression_r2"),
        },
        "area_labels": list(area_labels.get("character_tags") or []),
        "guardrails": {
            "write_business_judgment_not_data_description": True,
            "no_raw_metric_recital_as_headline": True,
            "user_profile_must_describe_people": True,
            "behavior_inference_must_describe_usage": True,
        },
    }


def _normalize_trait_list(items: Any, *, min_items: int = 2, max_items: int = 4) -> List[str]:
    traits: List[str] = []
    for item in items or []:
        text = _clean_text(item)
        if text and text not in traits:
            traits.append(text)
    if len(traits) < min_items:
        return []
    return traits[:max_items]


def _validate_summary_pack_payload(raw: Dict[str, Any], *, icsc_tags: List[str], evidence_refs: List[str]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    headline = raw.get("headline_judgment") if isinstance(raw.get("headline_judgment"), dict) else {}
    secondary_raw = raw.get("secondary_conclusions") if isinstance(raw.get("secondary_conclusions"), list) else []
    user_profile = raw.get("user_profile") if isinstance(raw.get("user_profile"), dict) else {}
    behavior = raw.get("behavior_inference") if isinstance(raw.get("behavior_inference"), dict) else {}
    secondary: List[Dict[str, str]] = []
    for item in secondary_raw:
        if not isinstance(item, dict):
            continue
        title = _clean_text(item.get("title"))
        reasoning = _clean_text(item.get("reasoning"))
        if title and reasoning:
            secondary.append({"title": title, "reasoning": reasoning})
    if len(secondary) < 2:
        return {}
    normalized = {
        "headline_judgment": {
            "summary": _clean_text(headline.get("summary")),
            "supporting_clause": _clean_text(headline.get("supporting_clause")),
        },
        "icsc_tags": list(icsc_tags),
        "secondary_conclusions": secondary[:4],
        "user_profile": {
            "headline": _clean_text(user_profile.get("headline")),
            "traits": _normalize_trait_list(user_profile.get("traits")),
        },
        "behavior_inference": {
            "headline": _clean_text(behavior.get("headline")),
            "traits": _normalize_trait_list(behavior.get("traits")),
        },
        "evidence_refs": list(evidence_refs),
        "confidence": "moderate" if len(evidence_refs) >= 2 else "weak",
    }
    if not normalized["headline_judgment"]["summary"]:
        return {}
    if not normalized["user_profile"]["headline"] or not normalized["user_profile"]["traits"]:
        return {}
    if not normalized["behavior_inference"]["headline"] or not normalized["behavior_inference"]["traits"]:
        return {}
    return normalized


def _build_summary_status(
    *,
    status: str,
    llm_available: bool,
    generated: bool,
    title: str,
    description: str,
    message: str = "",
    error_code: str = "",
    error_stage: str = "",
    retryable: bool = False,
) -> Dict[str, Any]:
    return {
        "status": status,
        "llm_available": bool(llm_available),
        "generated": bool(generated),
        "title": title,
        "description": description,
        "message": message,
        "error_code": error_code,
        "error_stage": error_stage,
        "retryable": bool(retryable),
    }


async def _generate_summary_pack_with_llm(snapshot: Any, artifacts: Dict[str, Any]) -> Dict[str, Any]:
    if not is_llm_enabled():
        return {}
    payload = await _invoke_json_role(
        system_prompt=_summary_pack_system_prompt(),
        user_payload=_build_summary_llm_payload(snapshot, artifacts),
        emit=None,
        phase="summary_pack",
        title="生成商业判断型总结",
        reasoning_id="summary-pack-reasoning",
    )
    icsc_tags = _derive_icsc_tags(snapshot, artifacts)
    evidence_refs = build_citations(snapshot, artifacts)
    return _validate_summary_pack_payload(payload, icsc_tags=icsc_tags, evidence_refs=evidence_refs)


async def evaluate_summary_readiness(payload: AgentSummaryRequest) -> AgentSummaryReadinessResponse:
    try:
        phases = ["precheck"]
        readiness_payload = await ensure_area_data_readiness(
            arguments={},
            snapshot=payload.analysis_snapshot,
            artifacts={},
            question="summary_readiness_precheck",
        )
        artifacts = dict(readiness_payload.get("artifacts") or {})
        structured = _derive_structured_status(payload.analysis_snapshot, artifacts)
        normalized = _normalize_data_readiness(
            readiness_payload,
            structured_missing_tasks=structured["missing_tasks"],
        )
        return AgentSummaryReadinessResponse(
            data_readiness=normalized,
            error=str(readiness_payload.get("error") or ""),
            warnings=[str(item) for item in (readiness_payload.get("warnings") or []) if str(item).strip()],
            phases=phases,
            progress_steps=_build_progress_steps(phases, failed=not normalized["ready"] and bool(readiness_payload.get("error"))),
        )
    except Exception as exc:
        phases = ["precheck"]
        return AgentSummaryReadinessResponse(
            data_readiness={
                "checked": False,
                "ready": False,
                "missing_tasks": ["poi_grid", "population", "nightlight", "road_syntax", "poi_structure", "spatial_structure", "area_labels"],
                "reused": [],
                "fetched": [],
            },
            error=f"summary_readiness_internal_error: {exc.__class__.__name__}",
            warnings=[str(exc)],
            phases=phases,
            progress_steps=_build_progress_steps(phases, failed=True),
        )


async def generate_summary_pack(payload: AgentSummaryRequest) -> AgentSummaryGenerateResponse:
    try:
        phases = ["precheck", "fetch_missing"]
        readiness_payload = await ensure_area_data_readiness(
            arguments={},
            snapshot=payload.analysis_snapshot,
            artifacts={},
            question="summary_generate_preflight",
        )
        warnings = [str(item) for item in (readiness_payload.get("warnings") or []) if str(item).strip()]
        error = str(readiness_payload.get("error") or "")
        artifacts = dict(readiness_payload.get("artifacts") or {})
        normalized = _normalize_data_readiness(readiness_payload)
        panel_payloads: Dict[str, Any] = {}
        summary_pack: Dict[str, Any] = {}
        summary_status = _build_summary_status(
            status="data_incomplete",
            llm_available=is_llm_enabled(),
            generated=False,
            title="总结待生成",
            description="当前区域还缺少基础分析结果，请先补齐 POI、H3、人口、夜光和路网分析。",
        )
        summary_status = {
            **summary_status,
            "error_code": "readiness_failed" if error else "",
            "error_stage": "precheck" if error else "",
            "retryable": bool(error),
        }
        if normalized["ready"]:
            phases.append("derive_analysis")
            pack_result = await run_area_character_pack(
                arguments={},
                snapshot=payload.analysis_snapshot,
                artifacts=artifacts,
                question="summary_generate_derive_analysis",
            )
            warnings.extend([str(item) for item in (pack_result.warnings or []) if str(item).strip()])
            if pack_result.status == "success":
                artifacts.update(dict(pack_result.artifacts or {}))
            else:
                error = str(pack_result.error or error or "derive_analysis_failed")
                summary_status = _build_summary_status(
                    status="generation_failed",
                    llm_available=is_llm_enabled(),
                    generated=False,
                    title="总结待生成",
                    description="结构化分析阶段失败，本次未生成正式总结。",
                    message=error,
                    error_code="derive_failed",
                    error_stage="derive_analysis",
                    retryable=True,
                )
            structured = _derive_structured_status(payload.analysis_snapshot, artifacts)
            normalized = _normalize_data_readiness(
                readiness_payload,
                structured_missing_tasks=structured["missing_tasks"],
                extra_fetched=_STRUCTURED_TASK_ORDER if pack_result.status == "success" else [],
            )
            if pack_result.status == "success":
                artifacts.update(dict(structured.get("artifacts") or {}))
            if normalized["ready"]:
                if not is_llm_enabled():
                    summary_status = _build_summary_status(
                        status="llm_unavailable",
                        llm_available=False,
                        generated=False,
                        title="总结待生成",
                        description="基础分析结果已就绪，但当前环境未启用可用模型，暂时无法生成商业判断型总结。",
                    )
                else:
                    try:
                        summary_pack = await _generate_summary_pack_with_llm(payload.analysis_snapshot, artifacts)
                    except Exception as exc:
                        error = f"summary_pack_generation_failed: {exc.__class__.__name__}"
                        warnings.append(str(exc))
                        summary_pack = {}
                    if summary_pack:
                        summary_status = _build_summary_status(
                            status="ready",
                            llm_available=True,
                            generated=True,
                            title="总结已生成",
                            description="已基于结构化证据生成商业判断型总结。",
                        )
                        phases.append("analysis_started")
                    else:
                        if not error:
                            error = "summary_pack_invalid"
                            warnings.append("summary_pack_missing_required_fields")
                        summary_status = _build_summary_status(
                            status="generation_failed",
                            llm_available=True,
                            generated=False,
                            title="总结待生成",
                            description="基础分析结果已就绪，但本次模型输出未通过结构校验，暂未生成正式总结。",
                            message=error,
                        )

        status_key = str(summary_status.get("status") or "")
        if status_key == "data_incomplete":
            if not summary_status.get("error_code"):
                summary_status["error_code"] = "readiness_failed" if error else ""
            if not summary_status.get("error_stage"):
                summary_status["error_stage"] = "precheck" if error else ""
            if "retryable" not in summary_status:
                summary_status["retryable"] = bool(error)
        elif status_key == "llm_unavailable":
            if not summary_status.get("error_code"):
                summary_status["error_code"] = "llm_unavailable"
            if not summary_status.get("error_stage"):
                summary_status["error_stage"] = "summary_pack"
            if "retryable" not in summary_status:
                summary_status["retryable"] = False
        elif status_key == "generation_failed":
            lowered_error = str(error or "").lower()
            if not summary_status.get("error_code"):
                if "derive" in lowered_error:
                    summary_status["error_code"] = "derive_failed"
                elif "invalid_chat_completion" in lowered_error or "empty_llm_output" in lowered_error:
                    summary_status["error_code"] = "llm_invalid_json"
                else:
                    summary_status["error_code"] = "schema_invalid"
            summary_status.setdefault("error_stage", "summary_pack")
            summary_status.setdefault("retryable", True)

        panel_payloads = build_summary_panel_payloads(
            "summary_generate",
            payload.analysis_snapshot,
            artifacts,
            summary_pack=summary_pack,
            summary_status=summary_status,
        )
        panel_payloads["data_readiness"] = dict(normalized)

        return AgentSummaryGenerateResponse(
            data_readiness=normalized,
            panel_payloads=_json_safe(panel_payloads),
            summary_pack=_json_safe(summary_pack),
            error=error,
            warnings=warnings,
            phases=phases,
            progress_steps=_build_progress_steps(
                phases,
                failed=(not normalized["ready"]) or (normalized["ready"] and not bool(summary_pack) and summary_status.get("status") == "generation_failed"),
            ),
        )
    except Exception as exc:
        phases = ["precheck", "fetch_missing"]
        return AgentSummaryGenerateResponse(
            data_readiness={
                "checked": True,
                "ready": False,
                "missing_tasks": ["poi_grid", "population", "nightlight", "road_syntax", "poi_structure", "spatial_structure", "area_labels"],
                "reused": [],
                "fetched": [],
            },
            panel_payloads={},
            summary_pack={},
            error=f"summary_generate_internal_error: {exc.__class__.__name__}",
            warnings=[str(exc)],
            phases=phases,
            progress_steps=_build_progress_steps(phases, failed=True),
        )
