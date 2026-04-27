from __future__ import annotations

from typing import Any, Dict, List

from .schemas import AgentContextSummary, AnalysisSnapshot, ContextBundle
from .tool_adapters.scope_tools import extract_scope_polygon


def _result_names(snapshot: AnalysisSnapshot, artifacts: Dict[str, Any] | None = None) -> List[str]:
    rows: List[str] = []
    current = artifacts or {}
    if current.get("current_pois") or snapshot.pois:
        rows.append("pois")
    if current.get("current_h3_summary") or (snapshot.h3 or {}).get("summary"):
        rows.append("h3")
    if current.get("current_road_summary") or (snapshot.road or {}).get("summary"):
        rows.append("road")
    if current.get("current_population_summary") or (snapshot.population or {}).get("summary"):
        rows.append("population")
    if current.get("current_nightlight_summary") or (snapshot.nightlight or {}).get("summary"):
        rows.append("nightlight")
    if current.get("business_site_advice"):
        rows.append("business_site_advice")
    if snapshot.frontend_analysis:
        rows.append("frontend_analysis")
    return rows


def build_context_summary(snapshot: AnalysisSnapshot, artifacts: Dict[str, Any] | None = None) -> AgentContextSummary:
    return AgentContextSummary(
        has_scope=bool(artifacts and artifacts.get("scope_polygon")) or bool(extract_scope_polygon(snapshot)),
        available_results=_result_names(snapshot, artifacts),
        active_panel=str(snapshot.active_panel or ""),
        filters_digest=dict(snapshot.current_filters or {}),
    )


def build_context_bundle(snapshot: AnalysisSnapshot) -> ContextBundle:
    h3_summary = (snapshot.h3 or {}).get("summary") if isinstance(snapshot.h3, dict) else {}
    road_summary = (snapshot.road or {}).get("summary") if isinstance(snapshot.road, dict) else {}
    population_summary = (snapshot.population or {}).get("summary") if isinstance(snapshot.population, dict) else {}
    nightlight_summary = (snapshot.nightlight or {}).get("summary") if isinstance(snapshot.nightlight, dict) else {}
    poi_summary = snapshot.poi_summary or {}
    facts = {
        "poi_count": int(poi_summary.get("total") or 0) if poi_summary.get("total") is not None else None,
        "h3_grid_count": int((h3_summary or {}).get("grid_count") or 0),
        "road_node_count": int((road_summary or {}).get("node_count") or 0),
        "population_total": (population_summary or {}).get("total_population"),
        "nightlight_peak_radiance": (nightlight_summary or {}).get("max_radiance"),
    }
    analysis = {
        "poi_summary": poi_summary,
        "h3_summary": h3_summary or {},
        "road_summary": road_summary or {},
        "population_summary": population_summary or {},
        "nightlight_summary": nightlight_summary or {},
        "frontend_analysis": dict(snapshot.frontend_analysis or {}),
    }
    limits = [
        "不能把推测写成事实。",
        "不能直接从 GIS 指标推断客流、消费能力、经营收益。",
        "人口、夜光、路网等结论必须基于对应 summary 字段。",
    ]
    return ContextBundle(
        facts=facts,
        analysis=analysis,
        limits=limits,
        available_artifacts=_result_names(snapshot),
        context_summary=build_context_summary(snapshot),
    )
