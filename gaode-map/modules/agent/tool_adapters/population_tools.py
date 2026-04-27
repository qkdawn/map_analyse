from __future__ import annotations

import asyncio
from typing import Any, Dict

from modules.population import get_population_overview

from ..schemas import AnalysisSnapshot, ToolResult


async def compute_population_overview_from_scope(
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
            tool_name="compute_population_overview_from_scope",
            status="failed",
            warnings=["缺少分析范围，无法计算人口概览"],
            error="missing_scope_polygon",
        )

    result = await asyncio.to_thread(
        get_population_overview,
        polygon,
        str(arguments.get("coord_type") or "gcj02"),
    )
    summary = result.get("summary") or {}
    return ToolResult(
        tool_name="compute_population_overview_from_scope",
        status="success",
        result={
            "total_population": float(summary.get("total_population") or 0.0),
            "male_ratio": float(summary.get("male_ratio") or 0.0),
            "female_ratio": float(summary.get("female_ratio") or 0.0),
        },
        evidence=[
            {"field": "population.summary.total_population", "value": float(summary.get("total_population") or 0.0)},
            {"field": "population.summary.male_ratio", "value": float(summary.get("male_ratio") or 0.0)},
            {"field": "population.summary.female_ratio", "value": float(summary.get("female_ratio") or 0.0)},
        ],
        warnings=[] if summary else ["当前范围未生成可用人口概览"],
        artifacts={
            "current_population": result,
            "current_population_summary": summary,
        },
    )
