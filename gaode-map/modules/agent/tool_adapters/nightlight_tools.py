from __future__ import annotations

import asyncio
from typing import Any, Dict

from modules.nightlight import get_nightlight_overview

from ..schemas import AnalysisSnapshot, ToolResult


async def compute_nightlight_overview_from_scope(
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
            tool_name="compute_nightlight_overview_from_scope",
            status="failed",
            warnings=["缺少分析范围，无法计算夜光概览"],
            error="missing_scope_polygon",
        )

    year = arguments.get("year") or snapshot.context.get("year")
    result = await asyncio.to_thread(
        get_nightlight_overview,
        polygon,
        str(arguments.get("coord_type") or "gcj02"),
        int(year) if isinstance(year, int) else None,
    )
    summary = result.get("summary") or {}
    return ToolResult(
        tool_name="compute_nightlight_overview_from_scope",
        status="success",
        result={
            "total_radiance": float(summary.get("total_radiance") or 0.0),
            "mean_radiance": float(summary.get("mean_radiance") or 0.0),
            "peak_radiance": float(summary.get("max_radiance") or 0.0),
            "lit_pixel_ratio": float(summary.get("lit_pixel_ratio") or 0.0),
        },
        evidence=[
            {"field": "nightlight.summary.total_radiance", "value": float(summary.get("total_radiance") or 0.0)},
            {"field": "nightlight.summary.mean_radiance", "value": float(summary.get("mean_radiance") or 0.0)},
            {"field": "nightlight.summary.peak_radiance", "value": float(summary.get("max_radiance") or 0.0)},
            {"field": "nightlight.summary.lit_pixel_ratio", "value": float(summary.get("lit_pixel_ratio") or 0.0)},
        ],
        warnings=[] if summary else ["当前范围未生成可用夜光概览"],
        artifacts={
            "current_nightlight": result,
            "current_nightlight_summary": summary,
        },
    )
