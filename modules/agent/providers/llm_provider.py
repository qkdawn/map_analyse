from __future__ import annotations

import inspect
import json
from typing import Any, Awaitable, Callable, Dict, List

import httpx

from core.config import settings

from ..analysis_extractors import (
    build_h3_structure_analysis,
    build_nightlight_pattern_analysis,
    build_population_profile_analysis,
    build_road_pattern_analysis,
    is_h3_structure_ready,
    is_nightlight_pattern_ready,
    is_poi_structure_ready,
    is_population_profile_ready,
    is_road_pattern_ready,
)
from ..context_builder import build_context_summary
from ..executor import execute_plan_step
from ..gate import classify_question_type, latest_user_message, run_gate
from ..governance import check_tool_governance
from ..planner import build_planning_fallback
from ..schemas import (
    AuditResult,
    AuditVerdict,
    AgentMessage,
    AgentTurnOutput,
    AnalysisSnapshot,
    ContextBundle,
    ExecutionTraceItem,
    GateDecision,
    PlanStep,
    PlanningResult,
    ToolLoopResult,
    ToolResult,
    WorkingMemory,
)
from ..tools import RegisteredTool

LoopEmit = Callable[[str, Dict[str, Any]], Awaitable[None] | None]


def is_llm_enabled() -> bool:
    return bool(
        settings.ai_enabled
        and str(settings.ai_provider or "").strip() == "deepseek"
        and str(settings.ai_base_url or "").strip()
        and str(settings.ai_api_key or "").strip()
        and str(settings.ai_model or "").strip()
    )


def _trim_messages(messages: List[AgentMessage]) -> List[Dict[str, str]]:
    max_turns = max(1, int(settings.ai_max_context_turns or 12))
    kept = messages[-max_turns:]
    normalized: List[Dict[str, str]] = []
    for item in kept:
        role = str(item.role or "").strip() or "user"
        content = str(item.content or "").strip()
        if content:
            normalized.append({"role": role, "content": content})
    return normalized


def _snapshot_digest(snapshot: AnalysisSnapshot) -> Dict[str, Any]:
    scope = snapshot.scope if isinstance(snapshot.scope, dict) else {}
    context = snapshot.context if isinstance(snapshot.context, dict) else {}
    current_filters = snapshot.current_filters if isinstance(snapshot.current_filters, dict) else {}
    h3_payload = snapshot.h3 if isinstance(snapshot.h3, dict) else {}
    road_payload = snapshot.road if isinstance(snapshot.road, dict) else {}
    population_payload = snapshot.population if isinstance(snapshot.population, dict) else {}
    nightlight_payload = snapshot.nightlight if isinstance(snapshot.nightlight, dict) else {}
    frontend_analysis = snapshot.frontend_analysis if isinstance(snapshot.frontend_analysis, dict) else {}
    return {
        "context": {
            "mode": context.get("mode"),
            "time_min": context.get("time_min"),
            "source": context.get("source"),
            "scope_source": context.get("scope_source"),
            "year": context.get("year"),
        },
        "scope": {
            "has_polygon": bool(scope.get("polygon") or scope.get("drawn_polygon")),
            "has_isochrone_feature": bool(scope.get("isochrone_feature")),
        },
        "poi": {
            "count": len(snapshot.pois or []),
            "summary": snapshot.poi_summary or {},
        },
        "h3": {
            "summary": h3_payload.get("summary") or {},
            "grid_count": h3_payload.get("grid_count") or 0,
        },
        "road": {"summary": road_payload.get("summary") or {}},
        "population": {"summary": population_payload.get("summary") or {}},
        "nightlight": {"summary": nightlight_payload.get("summary") or {}},
        "frontend_analysis_keys": list(frontend_analysis.keys())[:20],
        "active_panel": snapshot.active_panel,
        "current_filters": current_filters,
    }


def _context_digest(context: ContextBundle) -> Dict[str, Any]:
    return {
        "facts": dict(context.facts or {}),
        "analysis": dict(context.analysis or {}),
        "limits": list(context.limits or []),
        "available_artifacts": list(context.available_artifacts or []),
        "context_summary": context.context_summary.model_dump(),
    }


def _tool_catalog(registry: Dict[str, RegisteredTool]) -> List[Dict[str, Any]]:
    catalog: List[Dict[str, Any]] = []
    for name, registered in registry.items():
        spec = registered.spec
        catalog.append(
            {
                "name": name,
                "description": spec.description,
                "category": spec.category,
                "layer": spec.layer,
                "ui_tier": spec.ui_tier,
                "data_domain": spec.data_domain,
                "capability_type": spec.capability_type,
                "scene_type": spec.scene_type,
                "llm_exposure": spec.llm_exposure,
                "toolkit_id": spec.toolkit_id,
                "default_policy_key": spec.default_policy_key,
                "applicable_scenarios": list(spec.applicable_scenarios or []),
                "cautions": list(spec.cautions or []),
                "evidence_contract": list(spec.evidence_contract or []),
                "requires": list(spec.requires or []),
                "produces": list(spec.produces or []),
                "readonly": bool(spec.readonly),
                "cost_level": spec.cost_level,
                "risk_level": spec.risk_level,
                "input_schema": spec.input_schema,
            }
        )
    return catalog


def _llm_visible_registry(registry: Dict[str, RegisteredTool], *, include_secondary: bool = False) -> Dict[str, RegisteredTool]:
    visible: Dict[str, RegisteredTool] = {}
    for name, registered in registry.items():
        exposure = str(registered.spec.llm_exposure or "secondary")
        if exposure == "primary" or (include_secondary and exposure == "secondary"):
            visible[name] = registered
    return visible


def _planner_question_archetype(question: str) -> str:
    text = str(question or "").strip()
    question_type = classify_question_type(text)
    return question_type or "general"


def _artifact_digest(snapshot: AnalysisSnapshot, memory: WorkingMemory) -> Dict[str, Any]:
    artifacts = memory.artifacts if isinstance(memory.artifacts, dict) else {}
    poi_structure = artifacts.get("current_poi_structure_analysis") if isinstance(artifacts.get("current_poi_structure_analysis"), dict) else {}
    h3_structure = artifacts.get("current_h3_structure_analysis") if isinstance(artifacts.get("current_h3_structure_analysis"), dict) else build_h3_structure_analysis(snapshot, artifacts)
    population_profile = artifacts.get("current_population_profile_analysis") if isinstance(artifacts.get("current_population_profile_analysis"), dict) else build_population_profile_analysis(snapshot, artifacts)
    nightlight_pattern = artifacts.get("current_nightlight_pattern_analysis") if isinstance(artifacts.get("current_nightlight_pattern_analysis"), dict) else build_nightlight_pattern_analysis(snapshot, artifacts)
    road_pattern = artifacts.get("current_road_pattern_analysis") if isinstance(artifacts.get("current_road_pattern_analysis"), dict) else build_road_pattern_analysis(snapshot, artifacts)
    analysis_readiness = {
        "poi": is_poi_structure_ready(poi_structure),
        "h3": is_h3_structure_ready(h3_structure),
        "population": is_population_profile_ready(population_profile),
        "nightlight": is_nightlight_pattern_ready(nightlight_pattern),
        "road": is_road_pattern_ready(road_pattern),
    }
    summary_keys = [
        key
        for key in (
            "current_poi_summary",
            "current_h3_summary",
            "current_population_summary",
            "current_nightlight_summary",
            "current_road_summary",
        )
        if isinstance(artifacts.get(key), dict) and artifacts.get(key)
    ]
    if not summary_keys:
        if isinstance(snapshot.poi_summary, dict) and snapshot.poi_summary:
            summary_keys.append("snapshot.poi_summary")
        for key in ("h3", "population", "nightlight", "road"):
            payload = getattr(snapshot, key, {})
            if isinstance(payload, dict) and isinstance(payload.get("summary"), dict) and payload.get("summary"):
                summary_keys.append(f"snapshot.{key}.summary")
    analysis_keys = [
        key
        for key, ready in (
            ("current_poi_structure_analysis", analysis_readiness["poi"]),
            ("current_h3_structure_analysis", analysis_readiness["h3"]),
            ("current_population_profile_analysis", analysis_readiness["population"]),
            ("current_nightlight_pattern_analysis", analysis_readiness["nightlight"]),
            ("current_road_pattern_analysis", analysis_readiness["road"]),
        )
        if ready and isinstance(artifacts.get(key), dict) and artifacts.get(key)
    ]
    frontend_analysis = snapshot.frontend_analysis if isinstance(snapshot.frontend_analysis, dict) else {}
    frontend_keys = [key for key, value in frontend_analysis.items() if isinstance(value, dict) and value][:10]
    derived_keys = [
        key
        for key in (
            "current_business_profile",
            "current_commercial_hotspots",
            "current_target_supply_gap",
            "business_site_advice",
        )
        if isinstance(artifacts.get(key), dict) and artifacts.get(key)
    ]
    return {
        "summary_artifacts": summary_keys,
        "analysis_artifacts": analysis_keys,
        "analysis_readiness": analysis_readiness,
        "empty_analysis_dimensions": [key for key, ready in analysis_readiness.items() if not ready and key != "poi"],
        "derived_artifacts": derived_keys,
        "frontend_analysis_keys": frontend_keys,
        "available_artifacts": list(artifacts.keys()),
    }


def _planner_tool_routing_hints() -> Dict[str, Any]:
    return {
        "layers": {
            "foundation": [
                "read_current_scope",
                "read_current_results",
                "fetch_pois_in_scope",
                "compute_h3_metrics_from_scope_and_pois",
                "compute_population_overview_from_scope",
                "compute_nightlight_overview_from_scope",
                "compute_road_syntax_from_scope",
            ],
            "capability": [
                "get_area_data_bundle",
                "analyze_poi_structure",
                "analyze_spatial_structure",
                "infer_area_labels",
                "score_site_candidates",
            ],
            "scenario": [
                "run_area_character_pack",
                "run_site_selection_pack",
            ],
        },
        "priority_rules": [
            "优先场景工具，其次能力工具，最后基础工具。",
            "区域画像/调性判断默认优先 run_area_character_pack。",
            "开店/选址/补位/目标业态建议默认优先 run_site_selection_pack。",
            "只有用户明确只看单项人口、夜光、路网时，才直接调用单维基础工具。",
            "frontend_analysis 有键不等于可直接复用；analysis_readiness=false 时不要把空结构当证据。",
            "如果 audit_feedback 已经限定缺失证据，只补相关能力或基础工具，不要为了求全重跑全部场景包。",
        ],
        "dependencies": {
            "run_area_character_pack": ["scope_polygon"],
            "run_site_selection_pack": ["scope_polygon", "place_type 或问题中的目标业态"],
            "infer_area_labels": [
                "current_poi_structure_analysis",
                "current_population_profile_analysis",
                "current_nightlight_pattern_analysis",
                "current_road_pattern_analysis",
            ],
            "score_site_candidates": ["current_target_supply_gap"],
        },
        "question_routes": {
            "area_character": [
                "read_current_results",
                "run_area_character_pack",
            ],
            "site_selection": [
                "read_current_results",
                "run_site_selection_pack",
            ],
            "population": ["read_current_results", "compute_population_overview_from_scope"],
            "nightlight": ["read_current_results", "compute_nightlight_overview_from_scope"],
            "road": ["read_current_results", "compute_road_syntax_from_scope"],
        },
    }


def _extract_text_content(payload: Dict[str, Any]) -> str:
    if not isinstance(payload, dict):
        raise ValueError("invalid_chat_completion_payload")
    choices = payload.get("choices") or []
    if not choices:
        raise ValueError("invalid_chat_completion_payload")
    message = (choices[0] or {}).get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: List[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if isinstance(text, str) and text.strip():
                chunks.append(text.strip())
        if chunks:
            return "\n".join(chunks)
    raise ValueError("invalid_chat_completion_payload")


def _extract_json_object(raw_text: str) -> Dict[str, Any]:
    text = str(raw_text or "").strip()
    if not text:
        raise ValueError("empty_llm_output")
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            return json.loads(text[start:end + 1])
        raise


async def generate_title_with_llm(
    *,
    first_user_message: str,
    assistant_summary: str,
    status: str,
) -> str:
    system_prompt = (
        "你是 gaode-map 的对话标题生成器。"
        "请根据用户首轮问题和当前对话结果，生成一个简短、自然、可读的中文标题。"
        "要求："
        "1. 只输出标题本身，不要加引号、编号、解释或标点包装；"
        "2. 标题长度控制在 6 到 18 个汉字左右，最长不超过 24 个字符；"
        "3. 优先概括分析主题，不要复述完整问题；"
        "4. 如果结果是澄清、风险确认或失败，也要尽量概括用户想做的分析。"
    )
    user_payload = {
        "first_user_message": str(first_user_message or "").strip(),
        "assistant_summary": str(assistant_summary or "").strip(),
        "status": str(status or "").strip(),
    }
    base_url = str(settings.ai_base_url or "").rstrip("/")
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    request_body = {
        "model": settings.ai_model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
    }
    async with httpx.AsyncClient(timeout=float(settings.ai_timeout_s or 60)) as client:
        response = await client.post(f"{base_url}/chat/completions", headers=headers, json=request_body)
        response.raise_for_status()
        payload = response.json()
    content = _extract_text_content(payload)
    title = str(content or "").strip().strip("\"'“”‘’").splitlines()[0].strip()
    if not title:
        raise ValueError("empty_title_completion")
    return title[:24]


def _chat_completion_tools(registry: Dict[str, RegisteredTool]) -> List[Dict[str, Any]]:
    tools: List[Dict[str, Any]] = []
    for name, registered in _llm_visible_registry(registry).items():
        tools.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": registered.spec.description,
                    "parameters": registered.spec.input_schema or {
                        "type": "object",
                        "properties": {},
                        "additionalProperties": False,
                    },
                },
            }
        )
    return tools


def _with_thinking_mode(request_body: Dict[str, Any]) -> Dict[str, Any]:
    body = dict(request_body or {})
    model = str(body.get("model") or settings.ai_model or "").strip()
    if bool(settings.ai_thinking_enabled) and model != "deepseek-reasoner":
        body["thinking"] = {"type": "enabled"}
    return body


async def _iter_sse_data(response: httpx.Response):
    data_lines: List[str] = []
    async for line in response.aiter_lines():
        if line == "":
            if data_lines:
                yield "\n".join(data_lines)
                data_lines = []
            continue
        if line.startswith(":"):
            continue
        if line.startswith("data:"):
            data_lines.append(line[5:].lstrip())
    if data_lines:
        yield "\n".join(data_lines)


def _merge_tool_call_delta(accumulator: List[Dict[str, Any]], raw_call: Dict[str, Any]) -> None:
    if not isinstance(raw_call, dict):
        return
    raw_index = raw_call.get("index")
    index = int(raw_index) if isinstance(raw_index, int) or str(raw_index).isdigit() else len(accumulator)
    while len(accumulator) <= index:
        accumulator.append({"id": "", "type": "function", "function": {"name": "", "arguments": ""}})
    current = accumulator[index]
    if raw_call.get("id"):
        current["id"] = str(raw_call.get("id") or "")
    if raw_call.get("type"):
        current["type"] = str(raw_call.get("type") or "function")
    function_delta = raw_call.get("function") if isinstance(raw_call.get("function"), dict) else {}
    current_function = current.setdefault("function", {"name": "", "arguments": ""})
    if function_delta.get("name"):
        current_function["name"] = str(current_function.get("name") or "") + str(function_delta.get("name") or "")
    if function_delta.get("arguments") is not None:
        current_function["arguments"] = str(current_function.get("arguments") or "") + str(function_delta.get("arguments") or "")


def _finalize_tool_calls(accumulator: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    finalized: List[Dict[str, Any]] = []
    for item in accumulator:
        function_payload = item.get("function") if isinstance(item.get("function"), dict) else {}
        if not (str(item.get("id") or "").strip() or str(function_payload.get("name") or "").strip()):
            continue
        finalized.append(
            {
                "id": str(item.get("id") or function_payload.get("name") or "").strip(),
                "type": str(item.get("type") or "function"),
                "function": {
                    "name": str(function_payload.get("name") or "").strip(),
                    "arguments": str(function_payload.get("arguments") or ""),
                },
            }
        )
    return finalized


async def _stream_chat_completion(
    *,
    client: httpx.AsyncClient,
    base_url: str,
    headers: Dict[str, str],
    request_body: Dict[str, Any],
    emit: LoopEmit | None = None,
    reasoning_id: str = "llm-reasoning",
    phase: str = "planned",
    title: str = "模型思考",
) -> Dict[str, Any]:
    body = _with_thinking_mode({**request_body, "stream": True})
    response_id = ""
    finish_reason = ""
    content_parts: List[str] = []
    reasoning_parts: List[str] = []
    tool_call_accumulator: List[Dict[str, Any]] = []

    async with client.stream("POST", f"{base_url}/chat/completions", headers=headers, json=body) as response:
        response.raise_for_status()
        async for raw_data in _iter_sse_data(response):
            if raw_data.strip() == "[DONE]":
                break
            try:
                chunk = json.loads(raw_data)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid_chat_completion_stream_chunk:{exc}") from exc
            if chunk.get("id"):
                response_id = str(chunk.get("id") or response_id)
            choices = chunk.get("choices") if isinstance(chunk.get("choices"), list) else []
            if not choices:
                continue
            choice = choices[0] if isinstance(choices[0], dict) else {}
            if choice.get("finish_reason"):
                finish_reason = str(choice.get("finish_reason") or "")
            delta = choice.get("delta") if isinstance(choice.get("delta"), dict) else {}
            reasoning_delta = delta.get("reasoning_content")
            if isinstance(reasoning_delta, str) and reasoning_delta:
                reasoning_parts.append(reasoning_delta)
                await _maybe_emit(
                    emit,
                    "reasoning_delta",
                    {
                        "id": reasoning_id,
                        "phase": phase,
                        "title": title,
                        "delta": reasoning_delta,
                        "state": "active",
                    },
                )
            content_delta = delta.get("content")
            if isinstance(content_delta, str) and content_delta:
                content_parts.append(content_delta)
            for raw_call in delta.get("tool_calls") or []:
                _merge_tool_call_delta(tool_call_accumulator, raw_call)

    if reasoning_parts:
        await _maybe_emit(
            emit,
            "reasoning_delta",
            {
                "id": reasoning_id,
                "phase": phase,
                "title": title,
                "delta": "",
                "state": "completed",
            },
        )
    return {
        "id": response_id,
        "choices": [
            {
                "finish_reason": finish_reason or "stop",
                "message": {
                    "role": "assistant",
                    "content": "".join(content_parts),
                    "reasoning_content": "".join(reasoning_parts),
                    "tool_calls": _finalize_tool_calls(tool_call_accumulator),
                },
            }
        ],
    }


def _loop_system_prompt() -> str:
    return (
        "你是 gaode-map 的 GIS Agent 工具调度器。"
        "你的职责是基于用户问题、当前 analysis snapshot 摘要、上下文限制和可用工具，决定是否调用工具。"
        "要求："
        "1. 只通过已提供的 tools 调用函数，不要虚构工具名；"
        "2. 缺少 scope 时不要编造结论；"
        "3. 优先复用 read_current_scope / read_current_results；"
        "4. 只有在确实需要新证据时才调用高成本工具；"
        "5. 当现有证据足够时，停止调用工具并输出简短中文总结；"
        "6. 区域画像/调性判断优先调用 run_area_character_pack；"
        "7. 遇到开店、选址、补位、目标业态建议类问题时，优先调用 run_site_selection_pack；"
        "8. 只有用户只问单项指标时才直接调用人口、夜光、路网等基础工具；"
        "9. 不要把 GIS 指标直接推断成客流、消费能力或经营收益。"
    )


def _parse_chat_completion_response(payload: Dict[str, Any]) -> Dict[str, Any]:
    function_calls: List[Dict[str, Any]] = []
    texts: List[str] = []
    warnings: List[str] = []
    choices = payload.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return {"function_calls": function_calls, "texts": texts, "warnings": warnings}
    choice = choices[0]
    message = choice.get("message") if isinstance(choice.get("message"), dict) else {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        texts.append(content.strip())
    raw_tool_calls = message.get("tool_calls") or []
    for item in raw_tool_calls:
        if not isinstance(item, dict):
            continue
        function_payload = item.get("function") if isinstance(item.get("function"), dict) else {}
        arguments: Dict[str, Any] = {}
        argument_error = ""
        raw_arguments = function_payload.get("arguments")
        if isinstance(raw_arguments, dict):
            arguments = raw_arguments
        elif isinstance(raw_arguments, str) and raw_arguments.strip():
            try:
                parsed = json.loads(raw_arguments)
            except json.JSONDecodeError as exc:
                argument_error = f"invalid_tool_call_arguments_json:{exc}"
            else:
                if isinstance(parsed, dict):
                    arguments = parsed
                else:
                    argument_error = "invalid_tool_call_arguments_shape"
        function_calls.append(
            {
                "tool_name": str(function_payload.get("name") or "").strip(),
                "arguments": arguments,
                "call_id": str(item.get("id") or "").strip(),
                "argument_error": argument_error,
            }
        )
    finish_reason = str(choice.get("finish_reason") or "").strip()
    if finish_reason and finish_reason not in {"tool_calls", "stop"}:
        warnings.append(f"unexpected_finish_reason:{finish_reason}")
    return {"function_calls": function_calls, "texts": texts, "warnings": warnings}


def _extract_chat_completion_text(payload: Dict[str, Any]) -> str:
    parsed = _parse_chat_completion_response(payload)
    texts = [str(item).strip() for item in parsed.get("texts") or [] if str(item).strip()]
    if texts:
        return "\n".join(texts)
    raise ValueError("invalid_chat_completion_output_text")


def _tool_output_payload(result: ToolResult) -> str:
    return json.dumps(
        {
            "tool_name": result.tool_name,
            "status": result.status,
            "result": result.result,
            "evidence": result.evidence,
            "warnings": result.warnings,
            "error": result.error,
        },
        ensure_ascii=False,
    )


def _compact_json(value: Any, *, max_length: int = 160) -> str:
    if value in (None, "", [], {}):
        return ""
    text = json.dumps(value, ensure_ascii=False, default=str)
    if len(text) > max_length:
        return f"{text[:max_length]}..."
    return text


def _summarize_tool_arguments(arguments: Dict[str, Any]) -> str:
    if not isinstance(arguments, dict) or not arguments:
        return "无参数"
    preferred = ("place_type", "types", "keywords", "resolution", "include_mode", "mode", "graph_model", "highway_filter", "year", "max_count", "coord_type")
    items = []
    for key in preferred:
        if key in arguments and arguments.get(key) not in (None, "", [], {}):
            items.append(f"{key}={arguments.get(key)}")
    if not items:
        for key, value in list(arguments.items())[:4]:
            if value not in (None, "", [], {}):
                items.append(f"{key}={_compact_json(value, max_length=40)}")
    return "；".join(items) or "无参数"


def _summarize_tool_result(result: ToolResult) -> str:
    if result.status == "failed":
        return str(result.error or "执行失败")
    payload = result.result if isinstance(result.result, dict) else {}
    if not payload:
        return "执行成功"
    preferred = ("place_type", "poi_count", "h3_grid_count", "grid_count", "resolution", "road_node_count", "road_edge_count", "population_total", "nightlight_mean_radiance", "source", "total")
    items = []
    for key in preferred:
        if key in payload and payload.get(key) not in (None, "", [], {}):
            items.append(f"{key}={payload.get(key)}")
    if not items:
        for key, value in list(payload.items())[:4]:
            if value not in (None, "", [], {}):
                items.append(f"{key}={_compact_json(value, max_length=50)}")
    return "；".join(items) or "执行成功"


def _is_reusable_tool_call(registered: RegisteredTool, step: PlanStep) -> bool:
    return bool(
        registered.spec.readonly
        and registered.spec.name in {"read_current_scope", "read_current_results"}
        and not (step.arguments or {})
    )


def _tool_cache_key(step: PlanStep) -> str:
    return f"{step.tool_name}:{json.dumps(step.arguments or {}, ensure_ascii=False, sort_keys=True, default=str)}"


async def _maybe_emit(emit: LoopEmit | None, event_type: str, payload: Dict[str, Any]) -> None:
    if emit is None:
        return
    outcome = emit(event_type, payload)
    if inspect.isawaitable(outcome):
        await outcome


async def _invoke_json_role(
    *,
    system_prompt: str,
    user_payload: Dict[str, Any],
    emit: LoopEmit | None,
    phase: str,
    title: str,
    reasoning_id: str,
) -> Dict[str, Any]:
    base_url = str(settings.ai_base_url or "").rstrip("/")
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    request_body = {
        "model": settings.ai_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
        ],
    }
    async with httpx.AsyncClient(timeout=float(settings.ai_timeout_s or 60)) as client:
        payload = await _stream_chat_completion(
            client=client,
            base_url=base_url,
            headers=headers,
            request_body=request_body,
            emit=emit,
            reasoning_id=reasoning_id,
            phase=phase,
            title=title,
        )
    return _extract_json_object(_extract_chat_completion_text(payload))


def _gate_system_prompt() -> str:
    return (
        "你是 gaode-map 的门卫节点 Gatekeeper。"
        "你的任务是判断用户问题是否足够清晰、是否可以进入规划阶段。"
        "只输出 JSON。"
        "JSON 结构："
        "{\"status\":\"pass|clarify|block\",\"question_type\":\"area_character|site_selection|population|nightlight|road|vitality|tod|livability|facility_gap|renewal_priority|metric|general\","
        "\"summary\":\"...\",\"missing_information\":[\"...\"],\"clarification_questions\":[\"...\"],\"clarification_question\":\"...\",\"blocked_reason\":\"...\"}"
        "规则："
        "1. 如果问题已经足够清晰，返回 pass；"
        "2. 如果问题不清晰，只问最关键的 1 到 3 个问题；"
        "3. 澄清问题要具体，不要泛泛而谈；"
        "4. 不要编造 scope、结果或用户意图；"
        "5. clarification_questions 最多 3 条。"
    )


def _planner_system_prompt() -> str:
    return (
        "你是 gaode-map 的规划师 Planner。"
        "你的职责不是直接回答用户，而是基于用户问题、当前 analysis snapshot、已有 artifacts、审计反馈和工具目录，"
        "输出一份最小必要、证据驱动、可执行的结构化计划。"
        "只输出 JSON。"
        "JSON 结构："
        "{\"goal\":\"...\",\"question_type\":\"area_character|site_selection|population|nightlight|road|vitality|tod|livability|facility_gap|renewal_priority|metric|general\","
        "\"summary\":\"...\",\"requires_tools\":true,\"stop_condition\":\"...\",\"evidence_focus\":[\"...\"],"
        "\"steps\":[{\"tool_name\":\"...\",\"arguments\":{},\"reason\":\"...\",\"evidence_goal\":\"...\",\"expected_artifacts\":[\"...\"],\"optional\":false}]}"
        "规划原则："
        "1. 先识别任务类型：area_character、site_selection、population、nightlight、road、vitality、tod、livability、facility_gap、renewal_priority、metric 或 general；"
        "2. 默认优先场景工具，其次能力工具，最后基础工具；"
        "3. 区域画像/调性判断默认优先 run_area_character_pack；"
        "4. 开店/选址/补位/目标业态建议默认优先 run_site_selection_pack；"
        "5. 用户只问单项人口、夜光、路网时，才直接规划对应单维基础工具；"
        "6. 只有审计反馈要求补局部证据，或场景工具明显过重时，才下钻到能力工具或基础工具；"
        "7. frontend_analysis 中键存在不等于有可用分析；analysis_readiness=false 时不能把空结构当证据；"
        "8. 所有场景工具优先带 policy_key 或 analysis_mode，不要让模型自由发明细粒度 GIS 参数；"
        "9. 如果 audit_feedback 提供 missing_evidence，本轮优先只补这些缺口；"
        "10. steps 必须按执行顺序输出，reason、evidence_goal、expected_artifacts 必须具体；"
        "11. 如果已有证据足以直接回答，可以 requires_tools=false 且 steps 为空；"
        "12. 不要输出 registry 中不存在的工具名，不要把 GIS 指标直接当成客流、消费能力、营业额或收益证据。"
    )


def _auditor_system_prompt() -> str:
    return (
        "你是 gaode-map 的审计员 Auditor。"
        "你的任务是检查当前证据是否真的足够回答用户问题。"
        "只输出 JSON。"
        "JSON 结构："
        "{\"status\":\"pass|replan|fail\",\"summary\":\"...\",\"issues\":[\"...\"],\"missing_evidence\":[\"...\"],"
        "\"replan_instructions\":\"...\",\"should_answer\":true}"
        "规则："
        "1. 不要只看是否执行了工具，要看是否真正覆盖了问题维度；"
        "2. 证据不够时返回 replan，并明确缺什么、为什么缺；"
        "3. 无法可靠回答时返回 fail；"
        "4. 不要把 GIS 指标推断成客流、消费能力、营业额或收益。"
    )


def _synthesizer_system_prompt() -> str:
    return (
        "你是 gaode-map 的综合分析师 Synthesizer。"
        "请基于提供的结构化证据，输出最终 JSON 结果。"
        "必须只输出 JSON，不要输出 markdown。"
        "JSON 结构固定为："
        "{\"decision\":{\"summary\":\"...\",\"mode\":\"cognition|judgment|action\",\"strength\":\"strong|moderate|weak\",\"can_act\":true},"
        "\"support\":[{\"key\":\"...\",\"metric\":\"...\",\"headline\":\"...\",\"value\":{},\"interpretation\":\"...\",\"source\":\"...\",\"confidence\":\"strong|moderate|weak\",\"limitation\":\"...\",\"supports\":[\"core_judgment\"],\"is_key\":true}],"
        "\"counterpoints\":[{\"kind\":\"conflict|missing|boundary\",\"title\":\"...\",\"detail\":\"...\"}],"
        "\"actions\":[{\"title\":\"...\",\"detail\":\"...\",\"condition\":\"...\",\"target\":\"...\",\"prompt\":\"...\"}],"
        "\"boundary\":[{\"title\":\"...\",\"detail\":\"...\"}],"
        "\"cards\":[{\"type\":\"summary|evidence|recommendation\",\"title\":\"...\",\"content\":\"...\",\"items\":[\"...\"]}],"
        "\"next_suggestions\":[\"...\"]}"
        "规则："
        "1. decision 必须先回答当前能下什么判断，以及是否适合立刻行动；"
        "2. support 最多 3 条，每条都要能支撑主判断，不允许只列指标清单；"
        "3. counterpoints 必须覆盖冲突证据、缺失证据或解释边界，不能只给正向总结；"
        "4. actions 必须是可执行的下一步，不要写“建议继续分析”这种泛建议；"
        "5. boundary 必须明确哪些结论不能直接推出，尤其不能把 GIS 指标翻译成客流、消费能力、营业额或经营收益；"
        "6. cards 仍需输出三类卡片：summary 标题为“核心判断”，evidence 标题为“证据依据”，recommendation 标题为“下一步建议”；"
        "7. 只能使用给定证据，不要编造不存在的数据。"
    )


def _merge_plan_steps(primary: List[PlanStep], fallback: List[PlanStep]) -> List[PlanStep]:
    merged: List[PlanStep] = []
    lookup: Dict[tuple[str, str], PlanStep] = {}
    ordered_steps = list(primary or []) + list(fallback or [])
    priority = {"read_current_scope": 0, "read_current_results": 1}
    ordered_steps.sort(key=lambda step: priority.get(step.tool_name, 10))
    for step in ordered_steps:
        arguments = step.arguments if isinstance(step.arguments, dict) else {}
        key = (
            str(step.tool_name or "").strip(),
            json.dumps(arguments, ensure_ascii=False, sort_keys=True, default=str),
        )
        if not key[0]:
            continue
        if key in lookup:
            current = lookup[key]
            if not current.reason and step.reason:
                current.reason = step.reason
            if not current.evidence_goal and step.evidence_goal:
                current.evidence_goal = step.evidence_goal
            if not current.expected_artifacts and step.expected_artifacts:
                current.expected_artifacts = list(step.expected_artifacts or [])
            current.optional = current.optional and step.optional
            continue
        normalized = step.model_copy(deep=True)
        normalized.arguments = arguments
        lookup[key] = normalized
        merged.append(normalized)
    return merged


async def run_gate_with_llm(
    *,
    messages: List[AgentMessage],
    snapshot: AnalysisSnapshot,
    context: ContextBundle,
    emit: LoopEmit | None = None,
) -> GateDecision:
    rule_decision = run_gate(messages, snapshot)
    if rule_decision.status in {"clarify", "block"}:
        return rule_decision
    try:
        payload = await _invoke_json_role(
            system_prompt=_gate_system_prompt(),
            user_payload={
                "messages": _trim_messages(messages),
                "latest_user_message": latest_user_message(messages),
                "analysis_snapshot_digest": _snapshot_digest(snapshot),
                "context_digest": _context_digest(context),
                "context_summary": context.context_summary.model_dump(),
            },
            emit=emit,
            phase="gating",
            title="门卫判断问题是否清晰",
            reasoning_id="gatekeeper-reasoning",
        )
        decision = GateDecision(**payload)
    except Exception:
        return rule_decision
    if rule_decision.status == "pass" and decision.status == "pass" and not decision.summary:
        decision.summary = rule_decision.summary
    return decision


async def plan_with_llm(
    *,
    messages: List[AgentMessage],
    snapshot: AnalysisSnapshot,
    context: ContextBundle,
    registry: Dict[str, RegisteredTool],
    memory: WorkingMemory,
    audit_feedback: Dict[str, Any] | None = None,
    emit: LoopEmit | None = None,
) -> PlanningResult:
    question = latest_user_message(messages)
    visible_registry = _llm_visible_registry(registry)
    fallback = build_planning_fallback(
        question=question,
        snapshot=snapshot,
        memory=memory,
        audit_feedback=audit_feedback,
    )
    question_archetype = _planner_question_archetype(question)
    try:
        payload = await _invoke_json_role(
            system_prompt=_planner_system_prompt(),
            user_payload={
                "messages": _trim_messages(messages),
                "latest_user_message": question,
                "question_archetype": question_archetype,
                "analysis_snapshot_digest": _snapshot_digest(snapshot),
                "context_digest": _context_digest(context),
                "context_summary": context.context_summary.model_dump(),
                "artifact_digest": _artifact_digest(snapshot, memory),
                "available_tools": _tool_catalog(visible_registry),
                "available_artifacts": list(memory.artifacts.keys()),
                "tool_routing_hints": _planner_tool_routing_hints(),
                "audit_feedback": dict(audit_feedback or {}),
                "fallback_plan": fallback.model_dump(mode="json"),
            },
            emit=emit,
            phase="planning",
            title="规划本轮分析步骤",
            reasoning_id="planner-reasoning",
        )
        plan = PlanningResult(**payload)
    except Exception:
        return fallback
    plan.goal = plan.goal or fallback.goal
    plan.question_type = plan.question_type or fallback.question_type
    plan.summary = plan.summary or fallback.summary
    plan.stop_condition = plan.stop_condition or fallback.stop_condition
    plan.evidence_focus = list(plan.evidence_focus or fallback.evidence_focus)
    plan.steps = _merge_plan_steps(list(plan.steps or []), list(fallback.steps or []))
    plan.requires_tools = bool(plan.steps) if plan.requires_tools is False else (bool(plan.steps) or fallback.requires_tools)
    return plan


async def audit_with_llm(
    *,
    question: str,
    snapshot: AnalysisSnapshot,
    context: ContextBundle,
    memory: WorkingMemory,
    plan: PlanningResult,
    rule_audit: AuditResult,
    replan_count: int,
    emit: LoopEmit | None = None,
) -> AuditVerdict:
    fallback = AuditVerdict(
        status="replan" if rule_audit.missing_evidence else "pass",
        summary="当前证据仍需补齐。" if rule_audit.missing_evidence else "当前证据已满足最低回答条件。",
        issues=list(rule_audit.issues or []),
        missing_evidence=list(rule_audit.missing_evidence or []),
        replan_instructions=(
            f"请围绕 {'、'.join(rule_audit.missing_evidence)} 重新规划补证步骤。"
            if rule_audit.missing_evidence
            else ""
        ),
        should_answer=not bool(rule_audit.missing_evidence),
    )
    try:
        payload = await _invoke_json_role(
            system_prompt=_auditor_system_prompt(),
            user_payload={
                "question": question,
                "analysis_snapshot_digest": _snapshot_digest(snapshot),
                "context_digest": _context_digest(context),
                "plan": plan.model_dump(mode="json"),
                "tool_results": [item.model_dump(mode="json") for item in (memory.tool_results or [])],
                "execution_trace": [item.model_dump(mode="json") for item in (memory.execution_trace or [])],
                "available_artifacts": list(memory.artifacts.keys()),
                "rule_audit": rule_audit.model_dump(mode="json"),
                "replan_count": int(replan_count),
            },
            emit=emit,
            phase="auditing",
            title="审计本轮结果是否足够回答问题",
            reasoning_id="auditor-reasoning",
        )
        verdict = AuditVerdict(**payload)
    except Exception:
        return fallback
    verdict.issues = list(dict.fromkeys(list(verdict.issues or []) + list(rule_audit.issues or [])))
    verdict.missing_evidence = list(
        dict.fromkeys(list(verdict.missing_evidence or []) + list(rule_audit.missing_evidence or []))
    )
    if verdict.missing_evidence:
        verdict.status = "replan"
        verdict.should_answer = False
        if not verdict.replan_instructions:
            verdict.replan_instructions = f"请优先补齐 {'、'.join(verdict.missing_evidence)}。"
        if not verdict.summary:
            verdict.summary = "当前证据还不能稳定回答用户问题，需要先补齐关键维度。"
    elif not verdict.summary:
        verdict.summary = "当前证据通过审计，可以进入综合分析。"
    return verdict


async def run_llm_tool_loop(
    *,
    messages: List[AgentMessage],
    snapshot: AnalysisSnapshot,
    context: ContextBundle,
    registry: Dict[str, RegisteredTool],
    governance_mode: str,
    confirmed_tools: List[str] | None = None,
    emit: LoopEmit | None = None,
) -> ToolLoopResult:
    base_url = str(settings.ai_base_url or "").rstrip("/")
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    initial_payload = {
        "messages": _trim_messages(messages),
        "analysis_snapshot_digest": _snapshot_digest(snapshot),
        "context_digest": _context_digest(context),
        "context_summary": build_context_summary(snapshot).model_dump(),
        "available_tools": _tool_catalog(_llm_visible_registry(registry)),
    }
    loop_result = ToolLoopResult(artifacts={})
    loop_messages: List[Dict[str, Any]] = [
        {"role": "system", "content": _loop_system_prompt()},
        {"role": "user", "content": json.dumps(initial_payload, ensure_ascii=False)},
    ]
    consecutive_tool_errors = 0
    max_steps = max(1, int(settings.ai_max_tool_steps or 8))
    max_errors = max(1, int(settings.ai_max_tool_errors or 2))
    reusable_tool_results: Dict[str, ToolResult] = {}

    async with httpx.AsyncClient(timeout=float(settings.ai_timeout_s or 60)) as client:
        for step_index in range(max_steps):
            analysis_item_id = f"llm-loop-analysis-{step_index + 1}"
            await _maybe_emit(
                emit,
                "thinking",
                {
                    "id": analysis_item_id,
                    "phase": "planned",
                    "title": f"分析当前证据（第 {step_index + 1} 轮）",
                    "detail": "正在判断是否需要继续调用工具。",
                    "state": "active",
                },
            )
            request_body: Dict[str, Any] = {
                "model": settings.ai_model,
                "messages": loop_messages,
                "tools": _chat_completion_tools(registry),
                "tool_choice": "auto",
            }
            payload = await _stream_chat_completion(
                client=client,
                base_url=base_url,
                headers=headers,
                request_body=request_body,
                emit=emit,
                reasoning_id=analysis_item_id,
                phase="planned",
                title=f"模型思考（第 {step_index + 1} 轮）",
            )

            loop_result.provider_response_id = str(payload.get("id") or loop_result.provider_response_id or "")

            parsed = _parse_chat_completion_response(payload)
            loop_result.warnings.extend([str(item) for item in parsed["warnings"] if str(item).strip()])
            if parsed["texts"]:
                loop_result.assistant_summary = "\n".join(parsed["texts"]).strip()

            function_calls = [item for item in parsed["function_calls"] if str(item.get("tool_name") or "").strip()]
            if not function_calls:
                if loop_result.assistant_summary:
                    loop_result.status = "completed"
                    loop_result.stop_reason = "assistant_completed"
                    await _maybe_emit(
                        emit,
                        "thinking",
                        {
                            "id": analysis_item_id,
                            "phase": "planned",
                            "title": f"工具调度完成（第 {step_index + 1} 轮）",
                            "detail": "当前证据已足够，准备进入结果审计。",
                            "state": "completed",
                        },
                    )
                    return loop_result
                loop_result.status = "failed"
                loop_result.stop_reason = "no_parseable_output"
                loop_result.error = "DeepSeek chat completions 返回了不可解析的输出"
                return loop_result

            choice_message = {}
            choices = payload.get("choices") or []
            if choices and isinstance(choices[0], dict) and isinstance(choices[0].get("message"), dict):
                choice_message = choices[0]["message"]
            assistant_message = {
                "role": "assistant",
                "content": choice_message.get("content") or "",
                "tool_calls": choice_message.get("tool_calls") or [],
            }
            if choice_message.get("reasoning_content"):
                assistant_message["reasoning_content"] = choice_message.get("reasoning_content")
            loop_messages.append(assistant_message)
            for call in function_calls:
                tool_name = str(call.get("tool_name") or "").strip()
                registered = registry.get(tool_name)
                step = PlanStep(
                    tool_name=tool_name,
                    arguments=call.get("arguments") if isinstance(call.get("arguments"), dict) else {},
                    reason="LLM tool call",
                    expected_artifacts=list(registered.spec.produces or []) if registered else [],
                )
                loop_result.steps.append(step)
                await _maybe_emit(
                    emit,
                    "thinking",
                    {
                        "id": f"tool-call:{tool_name}",
                        "phase": "executing",
                        "title": f"准备调用 {tool_name}",
                        "detail": str(registered.spec.description if registered else "正在尝试执行工具。"),
                        "state": "active",
                    },
                )
                await _maybe_emit(
                    emit,
                    "trace",
                    {
                        "id": f"tool-call:{call.get('call_id') or tool_name}",
                        "call_id": str(call.get("call_id") or ""),
                        "tool_name": tool_name,
                        "status": "start",
                        "reason": step.reason,
                        "message": "开始执行工具",
                        "arguments_summary": _summarize_tool_arguments(step.arguments),
                        "produced_artifacts": list(step.expected_artifacts or []),
                    },
                )

                if registered is None:
                    loop_result.status = "failed"
                    loop_result.stop_reason = "unknown_tool"
                    loop_result.error = f"unknown_tool:{tool_name}"
                    return loop_result

                prompt = check_tool_governance(
                    mode=governance_mode,
                    spec=registered.spec,
                    confirmed_tools=confirmed_tools,
                )
                if prompt:
                    loop_result.status = "requires_risk_confirmation"
                    loop_result.stop_reason = "governance_blocked"
                    loop_result.risk_prompt = prompt
                    await _maybe_emit(
                        emit,
                        "trace",
                        {
                            "id": f"tool-call:{call.get('call_id') or tool_name}",
                            "call_id": str(call.get("call_id") or ""),
                            "tool_name": tool_name,
                            "status": "blocked",
                            "reason": step.reason,
                            "message": prompt,
                            "arguments_summary": _summarize_tool_arguments(step.arguments),
                            "produced_artifacts": list(step.expected_artifacts or []),
                        },
                    )
                    return loop_result

                argument_error = str(call.get("argument_error") or "").strip()
                if argument_error:
                    result = ToolResult(
                        tool_name=tool_name,
                        status="failed",
                        warnings=[argument_error],
                        error="invalid_tool_call_arguments",
                    )
                    loop_result.tool_results.append(result)
                    consecutive_tool_errors += 1
                    await _maybe_emit(
                        emit,
                        "trace",
                        {
                            "id": f"tool-call:{call.get('call_id') or tool_name}",
                            "call_id": str(call.get("call_id") or ""),
                            "tool_name": tool_name,
                            "status": "failed",
                            "reason": step.reason,
                            "message": argument_error,
                            "arguments_summary": _summarize_tool_arguments(step.arguments),
                            "result_summary": argument_error,
                            "evidence_count": 0,
                            "warning_count": len(result.warnings or []),
                            "produced_artifacts": [],
                        },
                    )
                    loop_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": str(call.get("call_id") or tool_name),
                            "content": _tool_output_payload(result),
                        }
                    )
                    if consecutive_tool_errors >= max_errors:
                        loop_result.status = "failed"
                        loop_result.stop_reason = "too_many_tool_errors"
                        loop_result.error = "连续工具调用参数错误过多"
                        return loop_result
                    continue

                cache_key = _tool_cache_key(step)
                if _is_reusable_tool_call(registered, step) and cache_key in reusable_tool_results:
                    cached_result = reusable_tool_results[cache_key]
                    trace = ExecutionTraceItem(
                        tool_name=registered.spec.name,
                        status="skipped",
                        reason=step.reason,
                        message="复用已有工具结果",
                        cost_level=registered.spec.cost_level,
                        risk_level=registered.spec.risk_level,
                        evidence_count=len(cached_result.evidence or []),
                        warning_count=len(cached_result.warnings or []),
                    )
                    loop_result.execution_trace.append(trace)
                    await _maybe_emit(
                        emit,
                        "trace",
                        {
                            "id": f"tool-call:{call.get('call_id') or tool_name}",
                            "call_id": str(call.get("call_id") or ""),
                            "tool_name": tool_name,
                            "status": trace.status,
                            "reason": step.reason,
                            "message": trace.message,
                            "arguments_summary": _summarize_tool_arguments(step.arguments),
                            "result_summary": _summarize_tool_result(cached_result),
                            "evidence_count": len(cached_result.evidence or []),
                            "warning_count": len(cached_result.warnings or []),
                            "produced_artifacts": list((cached_result.artifacts or {}).keys())[:12],
                        },
                    )
                    loop_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": str(call.get("call_id") or tool_name),
                            "content": _tool_output_payload(cached_result),
                        }
                    )
                    consecutive_tool_errors = 0
                    continue

                result, trace = await execute_plan_step(
                    registered_tool=registered,
                    step=step,
                    snapshot=snapshot,
                    artifacts=loop_result.artifacts,
                    question=str(messages[-1].content if messages else ""),
                )
                loop_result.execution_trace.append(trace)
                loop_result.used_tools.append(tool_name)
                loop_result.tool_results.append(result)
                if result.artifacts:
                    loop_result.artifacts.update(result.artifacts)
                if result.status == "success" and _is_reusable_tool_call(registered, step):
                    reusable_tool_results[cache_key] = result.model_copy(deep=True)
                if result.warnings:
                    loop_result.research_notes.extend([str(item) for item in result.warnings if str(item).strip()])
                await _maybe_emit(
                    emit,
                    "trace",
                    {
                        "id": f"tool-call:{call.get('call_id') or tool_name}",
                        "call_id": str(call.get("call_id") or ""),
                        "tool_name": tool_name,
                        "status": result.status,
                        "reason": step.reason,
                        "message": trace.message or ("执行成功" if result.status == "success" else "执行失败"),
                        "arguments_summary": _summarize_tool_arguments(step.arguments),
                        "result_summary": _summarize_tool_result(result),
                        "evidence_count": len(result.evidence or []),
                        "warning_count": len(result.warnings or []),
                        "produced_artifacts": list((result.artifacts or {}).keys())[:12],
                    },
                )
                consecutive_tool_errors = consecutive_tool_errors + 1 if result.status == "failed" else 0
                loop_messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": str(call.get("call_id") or tool_name),
                        "content": _tool_output_payload(result),
                    }
                )
                if consecutive_tool_errors >= max_errors:
                    loop_result.status = "failed"
                    loop_result.stop_reason = "too_many_tool_errors"
                    loop_result.error = str(result.error or "tool_execution_failed")
                    return loop_result

        loop_result.status = "failed"
        loop_result.stop_reason = "max_tool_steps_exceeded"
        loop_result.error = f"工具调用步数超过上限 {max_steps}"
        return loop_result


async def generate_answer_output_with_llm(
    *,
    messages: List[AgentMessage],
    snapshot: AnalysisSnapshot,
    context: ContextBundle,
    synthesis_payload: Dict[str, Any],
    emit: LoopEmit | None = None,
) -> AgentTurnOutput:
    parsed = await _invoke_json_role(
        system_prompt=_synthesizer_system_prompt(),
        user_payload={
            "messages": _trim_messages(messages),
            "analysis_snapshot_digest": _snapshot_digest(snapshot),
            "context_digest": _context_digest(context),
            "synthesis_payload": synthesis_payload,
        },
        emit=emit,
        phase="synthesizing",
        title="综合分析并生成最终结论",
        reasoning_id="synthesizer-reasoning",
    )
    return AgentTurnOutput(**parsed)
