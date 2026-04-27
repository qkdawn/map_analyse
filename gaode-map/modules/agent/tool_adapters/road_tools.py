from __future__ import annotations

import asyncio
from typing import Any, Dict

from modules.road.core import analyze_road_syntax

from ..schemas import AnalysisSnapshot, ToolResult


async def compute_road_syntax_from_scope(
    *,
    arguments: Dict[str, Any],
    snapshot: AnalysisSnapshot,
    artifacts: Dict[str, Any],
    question: str,
) -> ToolResult:
    del question
    polygon = artifacts.get("scope_polygon") or []
    if not polygon:
        return ToolResult(
            tool_name="compute_road_syntax_from_scope",
            status="failed",
            warnings=["缺少分析范围，无法计算路网句法"],
            error="missing_scope_polygon",
        )
    result = await asyncio.to_thread(
        analyze_road_syntax,
        polygon,
        "gcj02",
        str(arguments.get("mode") or snapshot.context.get("mode") or "walking"),
        str(arguments.get("graph_model") or "segment"),
        str(arguments.get("highway_filter") or "all"),
        False,
        None,
        None,
        "choice",
        None,
        None,
        True,
        0.025,
        False,
        None,
        60,
        None,
        None,
    )
    summary = result.get("summary") or {}
    return ToolResult(
        tool_name="compute_road_syntax_from_scope",
        status="success",
        result={
            "node_count": int(summary.get("node_count") or 0),
            "edge_count": int(summary.get("edge_count") or 0),
        },
        evidence=[
            {"field": "road.summary.node_count", "value": int(summary.get("node_count") or 0)},
            {"field": "road.summary.edge_count", "value": int(summary.get("edge_count") or 0)},
            {"field": "road.summary.avg_choice", "value": summary.get("avg_choice")},
        ],
        artifacts={
            "current_road": result,
            "current_road_summary": summary,
        },
    )
