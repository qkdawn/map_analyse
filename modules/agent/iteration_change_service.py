from __future__ import annotations

from typing import Any, Dict, List

from .providers.llm_provider import _invoke_json_role, is_llm_enabled


_REQUIRED_FIELDS = ("headline", "trend_summary", "hotspot_migration", "risk_or_opportunity")
_POI_REQUIRED_FIELDS = ("summary_points", "fastest_growth", "declining_category", "emerging_area", "structure_judgement")


def _clean_text(value: Any, max_len: int = 360) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    return text[:max_len]


def _validate_ai_analysis(raw: Dict[str, Any]) -> Dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    normalized = {key: _clean_text(raw.get(key)) for key in _REQUIRED_FIELDS}
    if not all(normalized.values()):
        return {}
    return normalized


def _clean_text_list(value: Any, *, max_items: int = 4, max_len: int = 180) -> List[str]:
    if isinstance(value, list):
        source = value
    else:
        source = [value]
    rows: List[str] = []
    for item in source:
        text = _clean_text(item, max_len=max_len)
        if text:
            rows.append(text)
        if len(rows) >= max_items:
            break
    return rows


def _validate_poi_ai_analysis(raw: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    summary_points = _clean_text_list(raw.get("summary_points"), max_items=4, max_len=180)
    insights = {
        "fastest_growth": _clean_text(raw.get("fastest_growth"), max_len=160),
        "declining_category": _clean_text(raw.get("declining_category"), max_len=160),
        "emerging_area": _clean_text(raw.get("emerging_area"), max_len=160),
        "structure_judgement": _clean_text(raw.get("structure_judgement"), max_len=220),
    }
    if not summary_points or not all(insights.values()):
        return {}
    return {"summary_points": summary_points, **insights}


def _nightlight_iteration_prompt() -> str:
    return (
        "你是商业地理与夜光遥感分析助手。"
        "请基于用户给出的近三年夜光序列、热点迁移分类和年度快照元信息，"
        "判断区域夜间活力的热点变化和迁移趋势。"
        "只输出 JSON 对象，字段必须为："
        "headline, trend_summary, hotspot_migration, risk_or_opportunity。"
        "不要编造未给出的方向、道路或商圈名称；如果证据不足，请明确说趋势信号有限。"
        "不要复述 base64 图片，也不要输出 markdown。"
    )


def _poi_iteration_prompt() -> str:
    return (
        "你是商业地理与POI多年变化分析助手。"
        "请基于用户给出的多年POI总量、业态结构、区域分布和变化指标，"
        "生成面向业务决策的解释层，而不是复述数据表。"
        "只输出JSON对象，字段必须为："
        "summary_points, fastest_growth, declining_category, emerging_area, structure_judgement。"
        "summary_points必须是2到4条中文短句，说明当前规模、主导业态、核心区域和结构判断。"
        "fastest_growth说明增长最快行业及证据；declining_category说明下滑行业及证据；"
        "emerging_area说明新兴聚集区域；structure_judgement总结消费型/生产型/混合型等业态倾向。"
        "不要编造未给出的行业、区域、商圈或百分比；证据不足时明确说明趋势信号有限。"
        "不要输出markdown。"
    )


async def generate_nightlight_iteration_analysis(evidence: Dict[str, Any]) -> Dict[str, Any]:
    if not is_llm_enabled():
        return {"status": "failed", "ai_analysis": {}, "error": "llm_unavailable"}
    try:
        raw = await _invoke_json_role(
            system_prompt=_nightlight_iteration_prompt(),
            user_payload={"task": "nightlight_iteration_change", "evidence": evidence or {}},
            emit=None,
            phase="nightlight_iteration_change",
            title="生成夜光多年变化解析",
            reasoning_id="nightlight-iteration-change",
        )
        analysis = _validate_ai_analysis(raw)
        if not analysis:
            return {"status": "failed", "ai_analysis": {}, "error": "invalid_ai_analysis"}
        return {"status": "ready", "ai_analysis": analysis, "error": ""}
    except Exception as exc:
        return {"status": "failed", "ai_analysis": {}, "error": f"{exc.__class__.__name__}: {exc}"}


async def generate_poi_iteration_analysis(evidence: Dict[str, Any]) -> Dict[str, Any]:
    if not is_llm_enabled():
        return {"status": "failed", "ai_summary": [], "ai_insights": {}, "error": "llm_unavailable"}
    try:
        raw = await _invoke_json_role(
            system_prompt=_poi_iteration_prompt(),
            user_payload={"task": "poi_iteration_change", "evidence": evidence or {}},
            emit=None,
            phase="poi_iteration_change",
            title="生成 POI 多年变化解析",
            reasoning_id="poi-iteration-change",
        )
        analysis = _validate_poi_ai_analysis(raw)
        if not analysis:
            return {"status": "failed", "ai_summary": [], "ai_insights": {}, "error": "invalid_ai_analysis"}
        return {
            "status": "ready",
            "ai_summary": analysis["summary_points"],
            "ai_insights": {
                "fastest_growth": analysis["fastest_growth"],
                "declining_category": analysis["declining_category"],
                "emerging_area": analysis["emerging_area"],
                "structure_judgement": analysis["structure_judgement"],
            },
            "error": "",
        }
    except Exception as exc:
        return {"status": "failed", "ai_summary": [], "ai_insights": {}, "error": f"{exc.__class__.__name__}: {exc}"}
