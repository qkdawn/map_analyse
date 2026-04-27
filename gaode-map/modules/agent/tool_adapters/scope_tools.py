from __future__ import annotations

from typing import Any, Dict, List

from ..schemas import AnalysisSnapshot, ToolResult


def _is_coord_pair(value: Any) -> bool:
    return isinstance(value, (list, tuple)) and len(value) >= 2 and all(isinstance(v, (int, float)) for v in value[:2])


def _extract_polygon_from_feature(feature: Dict[str, Any]) -> List[Any]:
    geometry = feature.get("geometry") if isinstance(feature, dict) else {}
    if not isinstance(geometry, dict):
        return []
    geom_type = str(geometry.get("type") or "")
    coords = geometry.get("coordinates")
    if geom_type in {"Polygon", "MultiPolygon"} and isinstance(coords, list):
        return coords
    return []


def _normalize_scope_polygon(raw: Any) -> List[Any]:
    if isinstance(raw, list) and raw:
        return raw
    return []


def extract_scope_polygon(snapshot: AnalysisSnapshot) -> List[Any]:
    scope = snapshot.scope if isinstance(snapshot.scope, dict) else {}
    for key in ("polygon", "drawn_polygon"):
        polygon = _normalize_scope_polygon(scope.get(key))
        if polygon:
            return polygon
    for key in ("isochrone_feature", "feature"):
        polygon = _extract_polygon_from_feature(scope.get(key) or {})
        if polygon:
            return polygon
    return []


async def read_current_scope(
    *,
    arguments: Dict[str, Any],
    snapshot: AnalysisSnapshot,
    artifacts: Dict[str, Any],
    question: str,
) -> ToolResult:
    del arguments, artifacts, question
    scope = snapshot.scope if isinstance(snapshot.scope, dict) else {}
    polygon = extract_scope_polygon(snapshot)
    isochrone_feature = scope.get("isochrone_feature") if isinstance(scope.get("isochrone_feature"), dict) else {}
    has_scope = bool(polygon)
    evidence = []
    if has_scope:
        evidence.append({"field": "scope.has_polygon", "value": True})
    if isochrone_feature:
        evidence.append({"field": "scope.has_isochrone_feature", "value": True})
    return ToolResult(
        tool_name="read_current_scope",
        status="success" if has_scope else "failed",
        result={
            "has_scope": has_scope,
            "active_panel": snapshot.active_panel,
        },
        evidence=evidence,
        warnings=[] if has_scope else ["当前 analysis snapshot 中缺少可用范围"],
        artifacts={
            "scope_polygon": polygon,
            "scope_data": scope,
            "isochrone_feature": isochrone_feature,
        },
        error=None if has_scope else "missing_scope_polygon",
    )
