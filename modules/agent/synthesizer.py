from __future__ import annotations

from typing import Any, Dict, List

from .analysis_extractors import (
    is_business_profile_ready,
    is_commercial_hotspots_ready,
    is_h3_structure_ready,
    is_nightlight_pattern_ready,
    is_poi_structure_ready,
    is_population_profile_ready,
    is_road_pattern_ready,
    is_target_supply_gap_ready,
)
from .intent_signals import mentions_nightlight, mentions_population, mentions_road, mentions_summary, mentions_supply
from .schemas import (
    AgentEvidenceItem,
    AgentTurnOutput,
    AnalysisSnapshot,
    AssistantCard,
    AuditResult,
    DecisionActionItem,
    DecisionBoundaryItem,
    DecisionCounterpointItem,
    DecisionEvidenceItem,
    DecisionPayload,
    ToolResult,
)

_ALL_BUSINESS_EVIDENCE = ["POI 供给证据", "H3 空间密度证据", "人口概览", "夜光概览", "路网概览"]


def _summary_metrics(snapshot: AnalysisSnapshot, artifacts: Dict[str, object]) -> Dict[str, object]:
    business_site_advice = artifacts.get("business_site_advice") if isinstance(artifacts.get("business_site_advice"), dict) else {}
    poi_structure = artifacts.get("current_poi_structure_analysis") if isinstance(artifacts.get("current_poi_structure_analysis"), dict) else {}
    h3_structure = artifacts.get("current_h3_structure_analysis") if isinstance(artifacts.get("current_h3_structure_analysis"), dict) else {}
    road_pattern = artifacts.get("current_road_pattern_analysis") if isinstance(artifacts.get("current_road_pattern_analysis"), dict) else {}
    population_profile = artifacts.get("current_population_profile_analysis") if isinstance(artifacts.get("current_population_profile_analysis"), dict) else {}
    nightlight_pattern = artifacts.get("current_nightlight_pattern_analysis") if isinstance(artifacts.get("current_nightlight_pattern_analysis"), dict) else {}
    business_profile = artifacts.get("current_business_profile") if isinstance(artifacts.get("current_business_profile"), dict) else {}
    commercial_hotspots = artifacts.get("current_commercial_hotspots") if isinstance(artifacts.get("current_commercial_hotspots"), dict) else {}
    target_supply_gap = artifacts.get("current_target_supply_gap") if isinstance(artifacts.get("current_target_supply_gap"), dict) else {}
    h3_summary = artifacts.get("current_h3_summary") or ((snapshot.h3 or {}).get("summary") if isinstance(snapshot.h3, dict) else {}) or {}
    road_summary = artifacts.get("current_road_summary") or ((snapshot.road or {}).get("summary") if isinstance(snapshot.road, dict) else {}) or {}
    population_summary = artifacts.get("current_population_summary") or ((snapshot.population or {}).get("summary") if isinstance(snapshot.population, dict) else {}) or {}
    nightlight_summary = artifacts.get("current_nightlight_summary") or ((snapshot.nightlight or {}).get("summary") if isinstance(snapshot.nightlight, dict) else {}) or {}
    poi_summary = artifacts.get("current_poi_summary") or snapshot.poi_summary or {}
    raw_poi_total = (poi_summary or {}).get("total")
    poi_count = int(raw_poi_total) if raw_poi_total is not None else None
    frontend_analysis = snapshot.frontend_analysis if isinstance(snapshot.frontend_analysis, dict) else {}
    poi_panel = frontend_analysis.get("poi") if isinstance(frontend_analysis.get("poi"), dict) else {}
    category_stats = poi_panel.get("category_stats") if isinstance(poi_panel.get("category_stats"), dict) else {}
    labels = [str(item) for item in (category_stats.get("labels") or []) if str(item).strip()]
    values = []
    for item in category_stats.get("values") or []:
        try:
            values.append(float(item))
        except (TypeError, ValueError):
            values.append(0.0)
    pairs = []
    total_category_value = sum(value for value in values if value > 0)
    for index, label in enumerate(labels):
        value = values[index] if index < len(values) else 0.0
        if value <= 0:
            continue
        ratio = (value / total_category_value) if total_category_value > 0 else 0.0
        pairs.append({"label": label, "count": int(value), "ratio": round(ratio, 4)})
    pairs.sort(key=lambda item: item["count"], reverse=True)
    return {
        "poi_count": poi_count,
        "h3_grid_count": int(h3_summary.get("grid_count") or 0),
        "avg_density_poi_per_km2": h3_summary.get("avg_density_poi_per_km2"),
        "road_node_count": int(road_summary.get("node_count") or 0),
        "road_edge_count": int(road_summary.get("edge_count") or 0),
        "population_total": population_summary.get("total_population"),
        "population_male_ratio": population_summary.get("male_ratio"),
        "population_female_ratio": population_summary.get("female_ratio"),
        "nightlight_total_radiance": nightlight_summary.get("total_radiance"),
        "nightlight_mean_radiance": nightlight_summary.get("mean_radiance"),
        "nightlight_peak_radiance": nightlight_summary.get("max_radiance"),
        "nightlight_lit_pixel_ratio": nightlight_summary.get("lit_pixel_ratio"),
        "business_place_type": business_site_advice.get("place_type"),
        "business_types": business_site_advice.get("types"),
        "business_keywords": business_site_advice.get("keywords"),
        "business_tool_statuses": business_site_advice.get("tool_statuses") or [],
        "poi_category_mix": pairs[:8],
        "poi_structure_summary": poi_structure.get("summary_text") if is_poi_structure_ready(poi_structure) else None,
        "poi_structure_tags": poi_structure.get("structure_tags") or [],
        "h3_distribution_pattern": h3_structure.get("distribution_pattern"),
        "h3_structure_summary": h3_structure.get("summary_text") if is_h3_structure_ready(h3_structure) else None,
        "road_pattern_summary": road_pattern.get("summary_text") if is_road_pattern_ready(road_pattern) else None,
        "population_profile_summary": population_profile.get("summary_text") if is_population_profile_ready(population_profile) else None,
        "nightlight_pattern_summary": nightlight_pattern.get("summary_text") if is_nightlight_pattern_ready(nightlight_pattern) else None,
        "business_profile_label": business_profile.get("business_profile") if is_business_profile_ready(business_profile) else None,
        "business_profile_portrait": business_profile.get("portrait") if is_business_profile_ready(business_profile) else None,
        "business_profile_summary": business_profile.get("summary_text") if is_business_profile_ready(business_profile) else None,
        "functional_mix_score": business_profile.get("functional_mix_score"),
        "commercial_hotspot_mode": commercial_hotspots.get("hotspot_mode") if is_commercial_hotspots_ready(commercial_hotspots) else None,
        "commercial_hotspot_summary": commercial_hotspots.get("summary_text") if is_commercial_hotspots_ready(commercial_hotspots) else None,
        "core_zone_count": commercial_hotspots.get("core_zone_count") if is_commercial_hotspots_ready(commercial_hotspots) else None,
        "opportunity_zone_count": commercial_hotspots.get("opportunity_zone_count") if is_commercial_hotspots_ready(commercial_hotspots) else None,
        "target_supply_gap_level": target_supply_gap.get("supply_gap_level") if is_target_supply_gap_ready(target_supply_gap) else None,
        "target_supply_gap_mode": target_supply_gap.get("gap_mode") if is_target_supply_gap_ready(target_supply_gap) else None,
        "target_supply_gap_summary": target_supply_gap.get("summary_text") if is_target_supply_gap_ready(target_supply_gap) else None,
        "target_supply_gap_place_type": target_supply_gap.get("place_type") if is_target_supply_gap_ready(target_supply_gap) else None,
        "target_supply_gap_candidates": target_supply_gap.get("candidate_zones") if is_target_supply_gap_ready(target_supply_gap) else [],
    }


def _evidence_confidence(value: Any, *, source_available: bool = True) -> str:
    if value in (None, "", [], {}):
        return "weak"
    return "moderate" if source_available else "weak"


def build_analysis_evidence(snapshot: AnalysisSnapshot, artifacts: Dict[str, object]) -> List[AgentEvidenceItem]:
    metrics = _summary_metrics(snapshot, artifacts)
    evidence: List[AgentEvidenceItem] = []
    if metrics["business_profile_label"]:
        evidence.append(
            AgentEvidenceItem(
                metric="business_profile",
                value={
                    "business_profile": metrics["business_profile_label"],
                    "portrait": metrics["business_profile_portrait"],
                    "functional_mix_score": metrics["functional_mix_score"],
                },
                interpretation="基于 POI 业态结构提炼的区域商业画像，可直接支撑“这是什么样的商业区”这类判断。",
                source="current_business_profile / current_poi_structure_analysis",
                confidence="moderate",
                limitation="商业画像反映供给结构，不直接等同于消费能力、客流或经营表现。",
            )
        )
    if metrics["commercial_hotspot_mode"]:
        evidence.append(
            AgentEvidenceItem(
                metric="commercial_hotspots",
                value={
                    "hotspot_mode": metrics["commercial_hotspot_mode"],
                    "core_zone_count": metrics["core_zone_count"],
                    "opportunity_zone_count": metrics["opportunity_zone_count"],
                },
                interpretation="空间热点结构用于判断区域是单核、多核、走廊还是离散分布。",
                source="current_commercial_hotspots / current_h3_structure_analysis",
                confidence="moderate",
                limitation="热点结构只能说明空间分布形态，不能直接代表商业收益高低。",
            )
        )
    if metrics["target_supply_gap_level"]:
        evidence.append(
            AgentEvidenceItem(
                metric="target_supply_gap",
                value={
                    "place_type": metrics["target_supply_gap_place_type"],
                    "supply_gap_level": metrics["target_supply_gap_level"],
                    "gap_mode": metrics["target_supply_gap_mode"],
                },
                interpretation="供给缺口结果用于判断目标业态是总量不足还是空间错配。",
                source="current_target_supply_gap / current_h3_structure_analysis",
                confidence="moderate",
                limitation="缺口判断只代表方向性结构机会，不直接代表开店成功率或收益。",
            )
        )
    if metrics["business_place_type"]:
        evidence.append(
            AgentEvidenceItem(
                metric="business_site_advice",
                value={
                    "place_type": metrics["business_place_type"],
                    "types": metrics["business_types"],
                    "keywords": metrics["business_keywords"],
                },
                interpretation="目标业态已解析为标准 POI 类型，后续供给、密度和空间证据围绕该业态组织。",
                source="business_site_advice",
                confidence="moderate",
                limitation="目标业态解析只代表 POI 检索口径，不代表经营可行性结论。",
            )
        )
    if metrics["poi_count"] is not None:
        evidence.append(
            AgentEvidenceItem(
                metric="poi_count",
                value=metrics["poi_count"],
                interpretation="区域内 POI 供给样本量，可用于判断商业供给基础。",
                source="analysis_snapshot.poi_summary / current_pois",
                confidence=_evidence_confidence(metrics["poi_count"]),
                limitation="POI 数量不能直接等同于客流、消费能力或经营收益。",
            )
        )
    if metrics["h3_grid_count"] or metrics["avg_density_poi_per_km2"] is not None:
        evidence.append(
            AgentEvidenceItem(
                metric="h3_density",
                value={
                    "grid_count": metrics["h3_grid_count"],
                    "avg_density_poi_per_km2": metrics["avg_density_poi_per_km2"],
                },
                interpretation="H3 网格和 POI 密度可用于观察空间供给分布与相对密集程度。",
                source="analysis_snapshot.h3.summary / current_h3_summary",
                confidence=_evidence_confidence(metrics["h3_grid_count"]),
                limitation="缺少竞品质量、租金和实地客流时，只能给方向性空间判断。",
            )
        )
    if metrics["road_node_count"] or metrics["road_edge_count"]:
        evidence.append(
            AgentEvidenceItem(
                metric="road_structure",
                value={"node_count": metrics["road_node_count"], "edge_count": metrics["road_edge_count"]},
                interpretation="路网节点与边段规模可辅助判断通达性和路网复杂度。",
                source="analysis_snapshot.road.summary / current_road_summary",
                confidence=_evidence_confidence(metrics["road_node_count"] or metrics["road_edge_count"]),
                limitation="仅凭节点/边段数量不能判断真实出行时间和道路拥堵。",
            )
        )
    if metrics["population_total"] is not None:
        evidence.append(
            AgentEvidenceItem(
                metric="population_profile",
                value={
                    "total_population": metrics["population_total"],
                    "male_ratio": metrics["population_male_ratio"],
                    "female_ratio": metrics["population_female_ratio"],
                },
                interpretation="人口总量与性别结构可辅助判断常住人群基础。",
                source="analysis_snapshot.population.summary / current_population_summary",
                confidence=_evidence_confidence(metrics["population_total"]),
                limitation="人口概览不能直接推断消费能力或具体客群偏好。",
            )
        )
    if metrics["nightlight_peak_radiance"] is not None or metrics["nightlight_mean_radiance"] is not None:
        evidence.append(
            AgentEvidenceItem(
                metric="nightlight_activity",
                value={
                    "total_radiance": metrics["nightlight_total_radiance"],
                    "mean_radiance": metrics["nightlight_mean_radiance"],
                    "peak_radiance": metrics["nightlight_peak_radiance"],
                    "lit_pixel_ratio": metrics["nightlight_lit_pixel_ratio"],
                },
                interpretation="夜光强度可作为夜间活力和建成活动的辅助信号。",
                source="analysis_snapshot.nightlight.summary / current_nightlight_summary",
                confidence=_evidence_confidence(metrics["nightlight_peak_radiance"] or metrics["nightlight_mean_radiance"]),
                limitation="夜光只能作为活力 proxy，不能直接代表营业额或客流。",
            )
        )
    return evidence


def _infer_output_mode(question: str) -> str:
    text = str(question or "")
    if any(token in text for token in ("下一步", "怎么做", "怎么办", "值不值得", "适不适合", "建议", "行动")):
        return "action"
    if any(token in text for token in ("适合", "值得", "是否", "可不可以", "能不能")):
        return "judgment"
    return "cognition"


def _evidence_headline(item: AgentEvidenceItem) -> str:
    if item.metric == "business_profile" and isinstance(item.value, dict):
        return f"商业画像偏向 {item.value.get('business_profile') or '未知'}"
    if item.metric == "commercial_hotspots" and isinstance(item.value, dict):
        return (
            f"空间热点结构为 {item.value.get('hotspot_mode') or '未知'}"
            f"，核心区 {item.value.get('core_zone_count') or 0} 个"
        )
    if item.metric == "target_supply_gap" and isinstance(item.value, dict):
        return (
            f"{item.value.get('place_type') or '目标业态'} 供给缺口"
            f" {item.value.get('supply_gap_level') or 'unknown'}"
        )
    if item.metric == "poi_count":
        return f"POI 样本量 {item.value}"
    if item.metric == "h3_density" and isinstance(item.value, dict):
        density = item.value.get("avg_density_poi_per_km2")
        return f"H3 网格 {item.value.get('grid_count') or 0} 个，平均密度 {density if density is not None else '未提供'}"
    if item.metric == "road_structure" and isinstance(item.value, dict):
        return f"路网节点 {item.value.get('node_count') or 0}、边段 {item.value.get('edge_count') or 0}"
    if item.metric == "population_profile" and isinstance(item.value, dict):
        return f"人口总量约 {item.value.get('total_population') if item.value.get('total_population') is not None else '未提供'}"
    if item.metric == "nightlight_activity" and isinstance(item.value, dict):
        mean_value = item.value.get("mean_radiance")
        return f"夜光均值 {mean_value if mean_value is not None else '未提供'}，峰值 {item.value.get('peak_radiance') if item.value.get('peak_radiance') is not None else '未提供'}"
    return item.metric


def _decision_strength(evidence: List[AgentEvidenceItem], audit: AuditResult) -> str:
    if audit.missing_evidence or audit.issues:
        return "weak"
    if len(evidence) >= 4:
        return "strong"
    if len(evidence) >= 2:
        return "moderate"
    return "weak"


def _interpretation_limits(evidence: List[AgentEvidenceItem], audit: AuditResult) -> List[str]:
    limits = ["不能直接从 GIS 指标推断客流、消费能力、营业额或经营收益。"]
    limits.extend([item.limitation for item in evidence if item.limitation])
    limits.extend([str(item) for item in audit.issues if str(item).strip()])
    deduped: List[str] = []
    for item in limits:
        if item and item not in deduped:
            deduped.append(item)
    return deduped


def _detect_conflicts(metrics: Dict[str, object], audit: AuditResult) -> List[str]:
    conflicts: List[str] = []
    population_total = metrics.get("population_total")
    nightlight_mean = metrics.get("nightlight_mean_radiance")
    poi_count = metrics.get("poi_count")
    road_nodes = metrics.get("road_node_count")
    density = metrics.get("avg_density_poi_per_km2")

    if nightlight_mean not in (None, "") and population_total not in (None, ""):
        try:
            if float(nightlight_mean) >= 3.0 and float(population_total) < 2000:
                conflicts.append("夜光活力信号较强，但人口基础偏弱，说明活力可能更依赖局部目的地或流动活动。")
        except (TypeError, ValueError):
            pass
    if poi_count not in (None, "") and road_nodes not in (None, ""):
        try:
            if int(poi_count) >= 20 and int(road_nodes) <= 40:
                conflicts.append("POI 供给量不低，但路网支撑偏弱，说明商业分布不一定能转化为高可达性。")
        except (TypeError, ValueError):
            pass
    if density not in (None, "") and metrics.get("target_supply_gap_level") in {"medium", "high"}:
        conflicts.append("空间密度不低，但目标业态仍存在缺口，说明问题更可能是结构错配而不是单纯总量不足。")
    for item in audit.issues or []:
        text = str(item).strip()
        if text and text not in conflicts:
            conflicts.append(text)
    return conflicts


def _select_key_evidence(evidence: List[AgentEvidenceItem], *, question: str) -> List[DecisionEvidenceItem]:
    preferred_order = []
    if mentions_supply(question):
        preferred_order = ["target_supply_gap", "business_site_advice", "commercial_hotspots", "h3_density", "road_structure"]
    elif mentions_nightlight(question):
        preferred_order = ["nightlight_activity", "population_profile", "road_structure", "poi_count"]
    elif mentions_population(question):
        preferred_order = ["population_profile", "poi_count", "nightlight_activity", "road_structure"]
    elif mentions_road(question):
        preferred_order = ["road_structure", "commercial_hotspots", "poi_count", "population_profile"]
    else:
        preferred_order = ["business_profile", "commercial_hotspots", "poi_count", "h3_density", "population_profile", "nightlight_activity", "road_structure"]
    ranking = {name: index for index, name in enumerate(preferred_order)}
    ordered = sorted(
        evidence,
        key=lambda item: (
            ranking.get(item.metric, 99),
            {"strong": 0, "moderate": 1, "weak": 2}.get(item.confidence, 2),
        ),
    )
    decision_key = "actionability" if _infer_output_mode(question) == "action" else "core_judgment"
    return [
        DecisionEvidenceItem(
            key=item.metric,
            metric=item.metric,
            headline=_evidence_headline(item),
            value=item.value,
            interpretation=item.interpretation,
            source=item.source,
            confidence=item.confidence,
            limitation=item.limitation,
            supports=[decision_key],
            is_key=True,
        )
        for item in ordered[:3]
    ]


def _build_decision_summary(
    *,
    question: str,
    metrics: Dict[str, object],
    decision_strength: str,
    conflicts: List[str],
    missing_evidence: List[str],
) -> str:
    portrait, _ = _infer_business_portrait(metrics)
    strength_label = {"strong": "较强", "moderate": "中等", "weak": "偏弱"}.get(decision_strength, "偏弱")
    base = str(metrics.get("business_profile_portrait") or "").strip() or f"当前更接近{portrait}。"
    if _infer_output_mode(question) == "action":
        if decision_strength == "strong" and not missing_evidence:
            text = f"{base} 当前证据强度为{strength_label}，可以继续做方向性判断和下一步预筛。"
        else:
            text = f"{base} 但当前证据强度为{strength_label}，更适合做预研判断，不适合直接拍板。"
    else:
        text = f"{base} 当前证据强度为{strength_label}。"
    if metrics.get("commercial_hotspot_summary"):
        text = f"{text} {metrics['commercial_hotspot_summary']}"
    if mentions_supply(question) and metrics.get("target_supply_gap_summary"):
        text = f"{text} {metrics['target_supply_gap_summary']}"
    if conflicts:
        text = f"{text} 不过{conflicts[0]}"
    elif missing_evidence:
        text = f"{text} 仍需补充 {'、'.join(missing_evidence[:2])} 后再做更强结论。"
    return text


def _build_counterpoints(
    *,
    conflicts: List[str],
    missing_evidence: List[str],
    limits: List[str],
) -> List[DecisionCounterpointItem]:
    items: List[DecisionCounterpointItem] = []
    for detail in conflicts[:3]:
        items.append(DecisionCounterpointItem(kind="conflict", title="冲突证据", detail=detail))
    for detail in missing_evidence[:3]:
        items.append(DecisionCounterpointItem(kind="missing", title="仍缺证据", detail=f"当前仍缺少 {detail}。"))
    for detail in limits[:2]:
        items.append(DecisionCounterpointItem(kind="boundary", title="解释边界", detail=detail))
    return items


def _build_boundary_items(limits: List[str]) -> List[DecisionBoundaryItem]:
    return [DecisionBoundaryItem(title="适用边界", detail=item) for item in limits[:4]]


def _build_action_items(
    *,
    question: str,
    metrics: Dict[str, object],
    audit: AuditResult,
    decision_strength: str,
) -> List[DecisionActionItem]:
    items: List[DecisionActionItem] = []
    if metrics.get("target_supply_gap_level") in {"medium", "high"}:
        items.append(
            DecisionActionItem(
                title="优先查看缺口候选格",
                detail="先看 gap 较高的候选格，再结合实地条件缩小范围。",
                condition="当目标是做补位或选址预筛时",
                target="site_selection",
                prompt=f"基于当前结果，继续细化候选格并比较{metrics.get('target_supply_gap_place_type') or '目标业态'}的机会区",
            )
        )
    if audit.missing_evidence:
        items.append(
            DecisionActionItem(
                title="先补齐关键证据",
                detail=f"优先补齐 {'、'.join(audit.missing_evidence[:2])}，再提高判断强度。",
                condition="当你需要更强结论时",
                target="evidence_gap",
                prompt=f"请补齐 {'、'.join(audit.missing_evidence[:2])}，再重新判断这个区域是否值得继续研究",
            )
        )
    if mentions_nightlight(question) or metrics.get("nightlight_mean_radiance") is not None:
        items.append(
            DecisionActionItem(
                title="核查夜光与业态是否一致",
                detail="把夜光热点与餐饮/休闲类 POI 分布对照，判断活力是否可转化为业务机会。",
                condition="当你关心夜间消费或活力时",
                target="vitality_check",
                prompt="对比夜光热点与餐饮娱乐 POI 的空间重合，判断夜间活力是否支撑商业机会",
            )
        )
    if not items:
        items.append(
            DecisionActionItem(
                title="继续收敛问题",
                detail="把问题进一步收敛到区域画像、选址预筛或活力判断中的一个，再进入下一轮分析。",
                condition="当当前问题仍偏宽泛时",
                target="clarify_goal",
                prompt="基于当前结果，告诉我下一步最值得继续的分析方向",
            )
        )
    if decision_strength == "strong" and len(items) > 1:
        return items[:3]
    return items[:2]


def _recommendation_layers(question: str, audit: AuditResult, decision_strength: str, metrics: Dict[str, object]) -> Dict[str, List[str]]:
    can_act_now = ["可以基于当前证据做方向性判断，优先使用证据较完整的指标作为依据。"]
    needs_more_analysis = []
    if metrics.get("commercial_hotspot_mode") == "multi_core":
        can_act_now.append("可以按多核结构分别审视核心区、次核心区和机会区，不要把整个范围当成单一板块。")
    if metrics.get("target_supply_gap_level") in {"medium", "high"}:
        can_act_now.append("可以优先排查 H3 gap 较高的机会区，再结合现场条件做二次筛选。")
    if audit.missing_evidence:
        needs_more_analysis.append(f"需要补充 {'、'.join(audit.missing_evidence)} 后再做强结论。")
    if decision_strength == "weak":
        needs_more_analysis.append("当前证据强度偏弱，建议先补齐关键数据再给具体选址或业态判断。")
    if any(token in question for token in ("餐饮", "零售", "咖啡", "购物", "补位", "选址")):
        needs_more_analysis.append("如需具体补位建议，应进一步比较目标业态 POI 密度、竞品分布和可达性。")
    do_not_infer = ["不建议直接推断客流、消费能力、营业额或收益。"]
    return {
        "can_act_now": can_act_now,
        "needs_more_analysis": needs_more_analysis,
        "do_not_infer": do_not_infer,
    }


def _infer_business_portrait(metrics: Dict[str, object]) -> tuple[str, List[str]]:
    mix = [item for item in (metrics.get("poi_category_mix") or []) if isinstance(item, dict)]
    if not mix:
        return "综合商业画像仍需更多业态结构信息", []

    top_labels = {str(item.get("label") or ""): float(item.get("ratio") or 0.0) for item in mix}
    ordered = [f"{item.get('label')} {item.get('count')} 个" for item in mix[:3]]
    dining_ratio = top_labels.get("餐饮", 0.0)
    shopping_ratio = top_labels.get("购物", 0.0)
    lodging_ratio = top_labels.get("住宿", 0.0)
    office_ratio = top_labels.get("公司", 0.0) + top_labels.get("商务住宅", 0.0)
    culture_ratio = top_labels.get("科教文化", 0.0)

    if dining_ratio + shopping_ratio >= 0.45:
        portrait = "生活消费主导的综合商业区"
    elif lodging_ratio >= 0.12:
        portrait = "住宿接待功能较强的复合片区"
    elif office_ratio >= 0.18:
        portrait = "商务与日常消费复合区"
    else:
        portrait = "多业态混合的综合服务片区"

    reasons: List[str] = []
    if ordered:
        reasons.append(f"头部业态为 {'、'.join(ordered)}。")
    if culture_ratio >= 0.1:
        reasons.append("科教文化设施占比不低，说明区域兼具公共服务或教育配套属性。")
    if office_ratio >= 0.12:
        reasons.append("公司与商务住宅占比有一定体量，说明商业功能并不只是纯生活配套。")
    if lodging_ratio >= 0.08:
        reasons.append("住宿设施占比不低，说明区域对流动人口或短停留活动也有承接能力。")
    return portrait, reasons


def _required_evidence_labels(question: str, audit: AuditResult) -> List[str]:
    required: List[str] = []
    for item in list(audit.required_evidence or []) + list(audit.missing_evidence or []):
        if item and item not in required:
            required.append(item)
    if required:
        return required
    if mentions_summary(question) or mentions_supply(question):
        return list(_ALL_BUSINESS_EVIDENCE)
    if mentions_population(question):
        return ["人口概览"]
    if mentions_nightlight(question):
        return ["夜光概览"]
    if mentions_road(question):
        return ["路网概览"]
    return []


def _metric_items_for_question(question: str, audit: AuditResult, metrics: Dict[str, object]) -> List[str]:
    required = set(_required_evidence_labels(question, audit))
    has_values = {
        "POI 供给证据": metrics["poi_count"] is not None,
        "H3 空间密度证据": bool(metrics["h3_grid_count"]) or metrics["avg_density_poi_per_km2"] is not None,
        "路网概览": bool(metrics["road_node_count"]) or bool(metrics["road_edge_count"]),
        "人口概览": metrics["population_total"] is not None,
        "夜光概览": metrics["nightlight_peak_radiance"] is not None or metrics["nightlight_mean_radiance"] is not None,
    }

    def should_include(label: str) -> bool:
        return label in required or bool(has_values.get(label))

    items: List[str] = []
    if metrics.get("business_profile_label"):
        items.append(f"区域画像：{metrics['business_profile_label']}")
    if metrics.get("business_profile_portrait"):
        items.append(f"画像说明：{metrics['business_profile_portrait']}")
    if metrics.get("commercial_hotspot_mode"):
        items.append(f"空间结构：{metrics['commercial_hotspot_mode']}")
    if metrics.get("target_supply_gap_level"):
        items.append(
            f"目标业态缺口：{metrics.get('target_supply_gap_place_type') or '未指定'} / {metrics['target_supply_gap_level']} / {metrics.get('target_supply_gap_mode') or 'unclear'}"
        )
    candidate_zones = metrics.get("target_supply_gap_candidates") or []
    if candidate_zones:
        items.append(f"候选格子：{len(candidate_zones)} 个")
    if metrics.get("business_place_type"):
        items.append(f"目标业态：{metrics['business_place_type']}")
        items.append(f"POI 类型：{metrics['business_types']}" if metrics.get("business_types") else "POI 类型：未提供")
    if should_include("POI 供给证据"):
        items.append(f"POI 数量：{metrics['poi_count']}" if metrics["poi_count"] is not None else "POI 数量：未提供总数")
    if should_include("H3 空间密度证据"):
        items.append(f"H3 网格数：{metrics['h3_grid_count']}")
        items.append(f"平均 POI 密度：{metrics['avg_density_poi_per_km2']}" if metrics["avg_density_poi_per_km2"] is not None else "平均 POI 密度：未提供")
    if should_include("路网概览"):
        items.append(f"路网节点数：{metrics['road_node_count']}")
        items.append(f"路网边段数：{metrics['road_edge_count']}")
    if should_include("人口概览"):
        items.append(f"人口总量：{metrics['population_total']}" if metrics["population_total"] is not None else "人口总量：未提供")
        items.append(f"男性占比：{metrics['population_male_ratio']}" if metrics["population_male_ratio"] is not None else "男性占比：未提供")
        items.append(f"女性占比：{metrics['population_female_ratio']}" if metrics["population_female_ratio"] is not None else "女性占比：未提供")
    if should_include("夜光概览"):
        items.append(f"夜光总辐亮度：{metrics['nightlight_total_radiance']}" if metrics["nightlight_total_radiance"] is not None else "夜光总辐亮度：未提供")
        items.append(f"夜光均值：{metrics['nightlight_mean_radiance']}" if metrics["nightlight_mean_radiance"] is not None else "夜光均值：未提供")
        items.append(f"夜光峰值：{metrics['nightlight_peak_radiance']}" if metrics["nightlight_peak_radiance"] is not None else "夜光峰值：未提供")
        items.append(f"亮灯像元比例：{metrics['nightlight_lit_pixel_ratio']}" if metrics["nightlight_lit_pixel_ratio"] is not None else "亮灯像元比例：未提供")
    return items


def _build_structured_output(
    *,
    question: str,
    snapshot: AnalysisSnapshot,
    artifacts: Dict[str, object],
    tool_results: List[ToolResult],
    research_notes: List[str],
    audit: AuditResult,
) -> Dict[str, Any]:
    metrics = _summary_metrics(snapshot, artifacts)
    evidence = build_analysis_evidence(snapshot, artifacts)
    decision_strength = _decision_strength(evidence, audit)
    conflicts = _detect_conflicts(metrics, audit)
    limits = _interpretation_limits(evidence, audit)
    mode = _infer_output_mode(question)
    support = _select_key_evidence(evidence, question=question)
    decision = DecisionPayload(
        summary=_build_decision_summary(
            question=question,
            metrics=metrics,
            decision_strength=decision_strength,
            conflicts=conflicts,
            missing_evidence=list(audit.missing_evidence or []),
        ),
        mode=mode,
        strength=decision_strength,
        can_act=decision_strength != "weak" and not bool(audit.missing_evidence),
    )
    counterpoints = _build_counterpoints(
        conflicts=conflicts,
        missing_evidence=list(audit.missing_evidence or []),
        limits=limits,
    )
    actions = _build_action_items(
        question=question,
        metrics=metrics,
        audit=audit,
        decision_strength=decision_strength,
    )
    boundary = _build_boundary_items(limits)
    return {
        "metrics": metrics,
        "evidence": evidence,
        "decision_strength": decision_strength,
        "conflicts": conflicts,
        "limits": limits,
        "decision": decision,
        "support": support,
        "counterpoints": counterpoints,
        "actions": actions,
        "boundary": boundary,
        "research_notes": list(research_notes or []),
        "tool_chain": [result.tool_name for result in tool_results if result.status == "success"],
    }


def build_cards(
    *,
    question: str,
    snapshot: AnalysisSnapshot,
    artifacts: Dict[str, object],
    tool_results: List[ToolResult],
    research_notes: List[str],
    audit: AuditResult,
) -> List[AssistantCard]:
    structured = _build_structured_output(
        question=question,
        snapshot=snapshot,
        artifacts=artifacts,
        tool_results=tool_results,
        research_notes=research_notes,
        audit=audit,
    )
    metrics = structured["metrics"]
    support = structured["support"]
    decision = structured["decision"]
    counterpoints = structured["counterpoints"]
    actions = structured["actions"]
    used_tool_names = structured["tool_chain"]
    strength_label = {"strong": "较强", "moderate": "中等", "weak": "偏弱"}.get(decision.strength, "偏弱")
    metric_items = _metric_items_for_question(question, audit, metrics)
    evidence_items = [f"{item.headline}；解释：{item.interpretation}；置信度：{item.confidence}" for item in support]

    recommendation_layers = _recommendation_layers(question, audit, decision.strength, metrics)
    recommendation_items = []
    recommendation_items.extend(_build_candidate_card_items(metrics.get("target_supply_gap_candidates") or []))
    recommendation_items.extend([f"下一步动作：{item.title}｜{item.detail}" for item in actions])
    recommendation_items.extend([f"可以直接采取：{item}" for item in recommendation_layers["can_act_now"]])
    recommendation_items.extend([f"需补充后判断：{item}" for item in recommendation_layers["needs_more_analysis"]])
    recommendation_items.extend([f"不建议直接推断：{item}" for item in recommendation_layers["do_not_infer"]])
    recommendation_items.extend([f"{item.title}：{item.detail}" for item in counterpoints])
    recommendation_items.extend(list(research_notes or []))
    recommendation_items.extend([str(item) for item in audit.issues if str(item).strip()])
    suggestion = actions[0].detail if actions else "可以先基于当前证据做方向性判断，再补齐关键缺口。"
    return [
        AssistantCard(
            type="summary",
            title="核心判断",
            content=f"{decision.summary} 证据强度：{strength_label}。",
            items=[f"执行链：{' -> '.join(used_tool_names) or '无'}"],
        ),
        AssistantCard(type="evidence", title="证据依据", content="当前回答基于以下结构化证据，而不是只复述工具执行状态。", items=metric_items + evidence_items),
        AssistantCard(type="recommendation", title="下一步建议", content=suggestion, items=recommendation_items),
    ]


def build_synthesis_payload(
    *,
    question: str,
    snapshot: AnalysisSnapshot,
    artifacts: Dict[str, object],
    tool_results: List[ToolResult],
    research_notes: List[str],
    audit: AuditResult,
) -> Dict[str, Any]:
    structured = _build_structured_output(
        question=question,
        snapshot=snapshot,
        artifacts=artifacts,
        tool_results=tool_results,
        research_notes=research_notes,
        audit=audit,
    )
    metrics = structured["metrics"]
    evidence = structured["evidence"]
    used_tool_names = structured["tool_chain"]
    tool_result_digest: List[Dict[str, Any]] = []
    for result in tool_results:
        tool_result_digest.append(
            {
                "tool_name": result.tool_name,
                "status": result.status,
                "result": dict(result.result or {}),
                "warnings": list(result.warnings or []),
            }
        )
    evidence_items = _metric_items_for_question(question, audit, metrics)
    return {
        "question": question,
        "tool_chain": used_tool_names,
        "metrics": metrics,
        "decision": structured["decision"].model_dump(mode="json"),
        "support": [item.model_dump(mode="json") for item in structured["support"]],
        "counterpoints": [item.model_dump(mode="json") for item in structured["counterpoints"]],
        "actions": [item.model_dump(mode="json") for item in structured["actions"]],
        "boundary": [item.model_dump(mode="json") for item in structured["boundary"]],
        "business_profile": {
            "portrait": metrics.get("business_profile_portrait") or _infer_business_portrait(metrics)[0],
            "type": metrics.get("business_profile_label") or _infer_business_portrait(metrics)[0],
            "top_category_mix": metrics.get("poi_category_mix") or [],
            "functional_mix_score": metrics.get("functional_mix_score"),
        },
        "spatial_structure": {
            "hotspot_mode": metrics.get("commercial_hotspot_mode"),
            "summary": metrics.get("commercial_hotspot_summary"),
            "core_zone_count": metrics.get("core_zone_count"),
            "opportunity_zone_count": metrics.get("opportunity_zone_count"),
        },
        "target_supply_gap": {
            "place_type": metrics.get("target_supply_gap_place_type"),
            "supply_gap_level": metrics.get("target_supply_gap_level"),
            "gap_mode": metrics.get("target_supply_gap_mode"),
            "summary": metrics.get("target_supply_gap_summary"),
            "candidate_zones": metrics.get("target_supply_gap_candidates") or [],
        },
        "evidence_matrix": [item.model_dump(mode="json") for item in evidence],
        "decision_strength": structured["decision_strength"],
        "interpretation_limits": structured["limits"],
        "recommendation_layers": _recommendation_layers(question, audit, structured["decision_strength"], metrics),
        "evidence_items": evidence_items,
        "tool_results": tool_result_digest,
        "research_notes": list(research_notes or []),
        "audit_issues": [str(item) for item in audit.issues if str(item).strip()],
        "missing_evidence": list(audit.missing_evidence or []),
        "required_evidence": _required_evidence_labels(question, audit),
    }


def build_next_suggestions(question: str, audit: AuditResult) -> List[str]:
    suggestions = ["继续追问更具体的业态、路网或空间结构问题。"]
    if audit.missing_evidence:
        suggestions.insert(0, f"如需更完整结论，可继续补充 { '、'.join(audit.missing_evidence) } 相关分析。")
    if any(token in question for token in ("人口", "人群", "居民", "常住", "性别")):
        suggestions.append("继续追问年龄结构或与周边商业供给的匹配关系。")
    return suggestions


def build_citations(snapshot: AnalysisSnapshot, artifacts: Dict[str, object]) -> List[str]:
    citations: List[str] = []
    if artifacts.get("current_h3_summary") or (snapshot.h3 or {}).get("summary"):
        citations.append("analysis_snapshot.h3.summary")
    if artifacts.get("current_road_summary") or (snapshot.road or {}).get("summary"):
        citations.append("analysis_snapshot.road.summary")
    if artifacts.get("current_population_summary") or (snapshot.population or {}).get("summary"):
        citations.append("analysis_snapshot.population.summary")
    if artifacts.get("current_nightlight_summary") or (snapshot.nightlight or {}).get("summary"):
        citations.append("analysis_snapshot.nightlight.summary")
    if artifacts.get("current_pois") or snapshot.pois:
        citations.append("analysis_snapshot.pois")
    if artifacts.get("business_site_advice"):
        citations.append("business_site_advice")
    if artifacts.get("current_business_profile"):
        citations.append("current_business_profile")
    if artifacts.get("current_commercial_hotspots"):
        citations.append("current_commercial_hotspots")
    if artifacts.get("current_target_supply_gap"):
        citations.append("current_target_supply_gap")
    return citations


def _build_candidate_card_items(candidate_zones: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for zone in candidate_zones[:3]:
        h3_id = str(zone.get("h3_id") or "").strip()
        label = str(zone.get("display_title") or zone.get("approx_address") or zone.get("label") or "候选格").strip()
        reason = str(zone.get("reason_summary") or "").strip()
        gap_score = zone.get("gap_score")
        if gap_score is not None:
            label = f"{label}｜缺口分数 {float(gap_score):.2f}"
        items.append(
            {
                "type": "h3_candidate",
                "label": label,
                "text": f"{label}{('｜判断：' + reason) if reason else ''}",
                "h3_id": h3_id,
                "approx_address": str(zone.get("approx_address") or "").strip(),
                "reason_summary": reason,
                "center_point": dict(zone.get("center_point") or {}) if isinstance(zone.get("center_point"), dict) else {},
            }
        )
    return items


def build_panel_payloads(question: str, snapshot: AnalysisSnapshot, artifacts: Dict[str, object]) -> Dict[str, Any]:
    payloads: Dict[str, Any] = {}
    metrics = _summary_metrics(snapshot, artifacts)
    one_line_conclusion = {
        "type_tag": str(metrics.get("business_profile_label") or "待补充"),
        "structure_desc": str(
            metrics.get("commercial_hotspot_summary")
            or metrics.get("h3_structure_summary")
            or "待补充"
        ),
        "value_judgment": str(
            metrics.get("target_supply_gap_summary")
            or metrics.get("business_profile_summary")
            or "待补充"
        ),
    }
    icsc_tags = [
        str(item).strip()
        for item in (
            (metrics.get("business_types") or [])
            if isinstance(metrics.get("business_types"), list)
            else []
        )
        if str(item).strip()
    ]
    if not icsc_tags:
        icsc_tags = [
            str(item).strip()
            for item in (
                (metrics.get("poi_structure_tags") or [])
                if isinstance(metrics.get("poi_structure_tags"), list)
                else []
            )
            if str(item).strip()
        ]
    evidence_refs = _build_default_citations(artifacts)
    payloads["summary_pack"] = {
        "one_line_conclusion": one_line_conclusion,
        "icsc_tags": icsc_tags,
        "key_metrics": {
            "poi_structure": {
                "poi_count": metrics.get("poi_count"),
                "summary": metrics.get("poi_structure_summary") or "暂无 POI 结构摘要",
            },
            "population_structure": {
                "population_total": metrics.get("population_total"),
                "summary": metrics.get("population_profile_summary") or "暂无人口结构摘要",
            },
            "nightlight_data": {
                "nightlight_mean_radiance": metrics.get("nightlight_mean_radiance"),
                "summary": metrics.get("nightlight_pattern_summary") or "暂无夜光结构摘要",
            },
            "road_accessibility": {
                "road_node_count": metrics.get("road_node_count"),
                "road_edge_count": metrics.get("road_edge_count"),
                "summary": metrics.get("road_pattern_summary") or "暂无路网可达性摘要",
            },
        },
        "behavior_inference": {
            "user_profile": metrics.get("business_profile_portrait") or metrics.get("business_profile_label") or "待补充",
            "consumption_features": metrics.get("business_profile_summary") or metrics.get("target_supply_gap_summary") or "待补充",
            "time_features": metrics.get("nightlight_pattern_summary") or "待补充",
        },
        "evidence_refs": evidence_refs,
        "confidence": "moderate" if len(evidence_refs) >= 2 else "weak",
    }
    if not (mentions_supply(question) or mentions_summary(question) or "current_h3" in artifacts or "current_h3_grid" in artifacts):
        return payloads
    current_h3 = artifacts.get("current_h3") if isinstance(artifacts.get("current_h3"), dict) else {}
    current_h3_grid = artifacts.get("current_h3_grid") if isinstance(artifacts.get("current_h3_grid"), dict) else {}
    current_h3_summary = artifacts.get("current_h3_summary") if isinstance(artifacts.get("current_h3_summary"), dict) else {}
    current_h3_charts = artifacts.get("current_h3_charts") if isinstance(artifacts.get("current_h3_charts"), dict) else {}
    target_supply_gap = artifacts.get("current_target_supply_gap") if isinstance(artifacts.get("current_target_supply_gap"), dict) else {}
    h3_structure = artifacts.get("current_h3_structure_analysis") if isinstance(artifacts.get("current_h3_structure_analysis"), dict) else {}
    grid = current_h3_grid or (current_h3.get("grid") if isinstance(current_h3.get("grid"), dict) else {})
    summary = current_h3_summary or (current_h3.get("summary") if isinstance(current_h3.get("summary"), dict) else {})
    charts = current_h3_charts or (current_h3.get("charts") if isinstance(current_h3.get("charts"), dict) else {})
    has_h3_payload = bool((grid or {}).get("features")) or bool(summary)
    if has_h3_payload:
        target_category = str(h3_structure.get("target_category") or "").strip()
        payloads["h3_result"] = {
            "grid": grid,
            "summary": summary,
            "charts": charts,
            "ui": {
                "main_stage": "evaluate" if is_target_supply_gap_ready(target_supply_gap) else "analysis",
                "sub_tab": "gap" if is_target_supply_gap_ready(target_supply_gap) else "metric_map",
                "target_category": target_category,
            },
        }
    return payloads


def enrich_answer_output(
    *,
    output: AgentTurnOutput,
    question: str,
    snapshot: AnalysisSnapshot,
    artifacts: Dict[str, object],
    tool_results: List[ToolResult] | None = None,
    research_notes: List[str] | None = None,
    audit: AuditResult | None = None,
) -> AgentTurnOutput:
    structured = _build_structured_output(
        question=question,
        snapshot=snapshot,
        artifacts=artifacts,
        tool_results=list(tool_results or []),
        research_notes=list(research_notes or []),
        audit=audit or AuditResult(),
    )
    cards = [AssistantCard.model_validate(item) if not isinstance(item, AssistantCard) else item for item in (output.cards or [])]
    target_supply_gap = artifacts.get("current_target_supply_gap") if isinstance(artifacts.get("current_target_supply_gap"), dict) else {}
    candidate_items = _build_candidate_card_items(list(target_supply_gap.get("candidate_zones") or []))
    if candidate_items and mentions_supply(question):
        summary = next((card for card in cards if card.type == "summary"), None)
        if summary is not None and "候选" not in str(summary.content or ""):
            summary.content = f"{summary.content} 优先可先查看前 3 个候选格。".strip()
    if candidate_items:
        recommendation = next((card for card in cards if card.type == "recommendation"), None)
        if recommendation is None:
            recommendation = AssistantCard(type="recommendation", title="下一步建议", content="", items=[])
            cards.append(recommendation)
        existing_candidate_ids = {
            str(item.get("h3_id") or "").strip()
            for item in recommendation.items
            if isinstance(item, dict) and str(item.get("type") or "").strip() == "h3_candidate"
        }
        for item in candidate_items:
            h3_id = str(item.get("h3_id") or "").strip()
            if h3_id and h3_id in existing_candidate_ids:
                continue
            recommendation.items.append(item)
        if not recommendation.content and mentions_supply(question):
            recommendation.content = "可先优先查看下面的候选格，再结合实地租金、竞品质量和动线做最终判断。"
    output.cards = cards
    if not getattr(output, "decision", None) or not str(output.decision.summary or "").strip():
        output.decision = structured["decision"]
    if not list(output.support or []):
        output.support = structured["support"]
    if not list(output.counterpoints or []):
        output.counterpoints = structured["counterpoints"]
    if not list(output.actions or []):
        output.actions = structured["actions"]
    if not list(output.boundary or []):
        output.boundary = structured["boundary"]
    output.panel_payloads = build_panel_payloads(question, snapshot, artifacts)
    return output
