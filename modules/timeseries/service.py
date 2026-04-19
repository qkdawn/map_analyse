from __future__ import annotations

from typing import Any, Iterable

from modules.nightlight.service import get_nightlight_grid, get_nightlight_layer, get_nightlight_overview
from modules.population.service import get_population_grid, get_population_layer, get_population_overview

POPULATION_YEARS = ("2024", "2025", "2026")
NIGHTLIGHT_YEARS = (2023, 2024, 2025)
COMMON_YEARS = (2024, 2025)

POPULATION_STABLE_RATE = 0.01
POPULATION_STABLE_DELTA = 1.0
NIGHTLIGHT_STABLE_RATE = 0.05
NIGHTLIGHT_STABLE_DELTA = 0.05

POPULATION_VIEWS = {
    "population_delta": {"label": "人口变化量", "unit": "人"},
    "population_rate": {"label": "人口变化率", "unit": "%"},
    "density_delta": {"label": "密度变化", "unit": "人/平方公里"},
    "age_shift": {"label": "主导年龄变化", "unit": "格网"},
}
NIGHTLIGHT_VIEWS = {
    "radiance_delta": {"label": "夜光变化量", "unit": "nWatts/(cm^2 sr)"},
    "radiance_rate": {"label": "夜光变化率", "unit": "%"},
    "hotspot_shift": {"label": "热点变化", "unit": "格网"},
    "lit_change": {"label": "亮区变化", "unit": "格网"},
}


def _round(value: Any, digits: int = 6) -> float:
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return 0.0


def _periods(years: Iterable[Any]) -> list[dict[str, Any]]:
    items = [str(item) for item in years]
    result: list[dict[str, Any]] = []
    for idx in range(len(items) - 1):
        start, end = items[idx], items[idx + 1]
        result.append({"value": f"{start}-{end}", "label": f"{start} -> {end}", "from_year": start, "to_year": end})
    if len(items) > 2:
        start, end = items[0], items[-1]
        result.append({"value": f"{start}-{end}", "label": f"{start} -> {end}", "from_year": start, "to_year": end})
    return result


def _parse_period(period: str, valid_years: Iterable[Any]) -> tuple[str, str]:
    years = [str(item) for item in valid_years]
    raw = str(period or "").strip()
    if "->" in raw:
        parts = [item.strip() for item in raw.split("->", 1)]
    else:
        parts = [item.strip() for item in raw.split("-", 1)]
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError(f"invalid timeseries period: {period}")
    start, end = parts[0], parts[1]
    if start not in years or end not in years:
        raise ValueError(f"period years must be in {', '.join(years)}")
    if years.index(start) >= years.index(end):
        raise ValueError("period start year must be earlier than end year")
    return start, end


def _cell_map(layer: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(cell.get("cell_id") or ""): cell
        for cell in (layer.get("cells") or [])
        if str(cell.get("cell_id") or "")
    }


def _feature_cell_ids(features: list[dict[str, Any]]) -> list[str]:
    ids: list[str] = []
    for feature in features:
        props = (feature or {}).get("properties") or {}
        cell_id = str(props.get("cell_id") or props.get("h3_id") or "")
        if cell_id:
            ids.append(cell_id)
    return ids


def _rate(delta: float, base: float) -> float:
    return float(delta) / float(base) if abs(float(base)) > 1e-9 else 0.0


def _diverging_cell(delta: float, rate: float, view: str) -> tuple[str, str, str, float]:
    if abs(delta) < 1e-9:
        return "stable", "基本稳定", "#e5e7eb", 0.38
    if delta > 0:
        if abs(rate) >= 0.20:
            return "strong_increase", "明显增长", "#b91c1c", 0.78
        return "increase", "增长", "#f97316", 0.66
    if view.endswith("_rate") and abs(rate) >= 0.20:
        return "strong_decrease", "明显下降", "#1d4ed8", 0.78
    return "decrease", "下降", "#38bdf8", 0.62


def _continuous_legend(title: str, unit: str) -> dict[str, Any]:
    return {
        "title": title,
        "kind": "continuous",
        "unit": unit,
        "min_value": -1.0,
        "max_value": 1.0,
        "stops": [
            {"ratio": 0.0, "color": "#1d4ed8", "value": -1.0, "label": "下降"},
            {"ratio": 0.5, "color": "#e5e7eb", "value": 0.0, "label": "稳定"},
            {"ratio": 1.0, "color": "#b91c1c", "value": 1.0, "label": "增长"},
        ],
    }


def _categorical_legend(title: str, items: list[tuple[str, str, str]]) -> dict[str, Any]:
    return {
        "title": title,
        "kind": "categorical",
        "unit": "格网",
        "min_value": 0.0,
        "max_value": 0.0,
        "stops": [
            {"ratio": 0.0, "color": color, "value": 0.0, "label": label, "key": key}
            for key, label, color in items
        ],
    }


def _summary_from_counts(cells: list[dict[str, Any]]) -> dict[str, Any]:
    counts: dict[str, int] = {}
    for cell in cells:
        key = str(cell.get("class_key") or "unknown")
        counts[key] = counts.get(key, 0) + 1
    deltas = [float(cell.get("delta") or 0.0) for cell in cells]
    rates = [float(cell.get("rate") or 0.0) for cell in cells]
    return {
        "cell_count": len(cells),
        "class_counts": counts,
        "increase_count": int(sum(1 for value in deltas if value > 0)),
        "decrease_count": int(sum(1 for value in deltas if value < 0)),
        "stable_count": int(counts.get("stable") or counts.get("joint_stable") or 0),
        "total_delta": _round(sum(deltas), 3),
        "average_rate": _round(sum(rates) / len(rates), 6) if rates else 0.0,
    }


def _top_age_label(overview: dict[str, Any]) -> str:
    items = overview.get("age_distribution") or []
    if not items:
        return "-"
    top = max(items, key=lambda item: float(item.get("total") or 0.0))
    return str(top.get("age_band_label") or top.get("age_band") or "-")


def get_timeseries_meta() -> dict[str, Any]:
    return {
        "population_years": list(POPULATION_YEARS),
        "nightlight_years": list(NIGHTLIGHT_YEARS),
        "common_years": list(COMMON_YEARS),
        "population_periods": _periods(POPULATION_YEARS),
        "nightlight_periods": _periods(NIGHTLIGHT_YEARS),
        "joint_periods": [{"value": "2024-2025", "label": "2024 -> 2025", "from_year": "2024", "to_year": "2025"}],
        "default_population_period": "2024-2026",
        "default_nightlight_period": "2023-2025",
        "default_joint_period": "2024-2025",
    }


def _population_series(polygon: list, coord_type: str) -> list[dict[str, Any]]:
    series = []
    for year in POPULATION_YEARS:
        overview = get_population_overview(polygon, coord_type, year)
        density = get_population_layer(polygon, coord_type, year=year, view="density")
        summary = overview.get("summary") or {}
        density_summary = density.get("summary") or {}
        series.append(
            {
                "year": year,
                "total_population": _round(summary.get("total_population"), 3),
                "male_total": _round(summary.get("male_total"), 3),
                "female_total": _round(summary.get("female_total"), 3),
                "average_density": _round(density_summary.get("average_value"), 3),
                "dominant_age_band": _top_age_label(overview),
            }
        )
    return series


def get_timeseries_population(polygon: list, coord_type: str = "gcj02", period: str = "2024-2026", layer_view: str = "population_delta") -> dict[str, Any]:
    safe_view = layer_view if layer_view in POPULATION_VIEWS else "population_delta"
    from_year, to_year = _parse_period(period, POPULATION_YEARS)
    series = _population_series(polygon, coord_type)
    grid = get_population_grid(polygon, coord_type, year=to_year)
    features = grid.get("features") or []
    cell_ids = _feature_cell_ids(features)

    if safe_view == "density_delta":
        from_layer = get_population_layer(polygon, coord_type, year=from_year, view="density")
        to_layer = get_population_layer(polygon, coord_type, year=to_year, view="density")
    elif safe_view == "age_shift":
        from_layer = get_population_layer(polygon, coord_type, year=from_year, view="age", age_mode="dominant", age_band="all")
        to_layer = get_population_layer(polygon, coord_type, year=to_year, view="age", age_mode="dominant", age_band="all")
    else:
        from_layer = get_population_layer(polygon, coord_type, year=from_year, view="overview")
        to_layer = get_population_layer(polygon, coord_type, year=to_year, view="overview")

    from_cells = _cell_map(from_layer)
    to_cells = _cell_map(to_layer)
    cells: list[dict[str, Any]] = []
    for cell_id in cell_ids:
        before = from_cells.get(cell_id) or {}
        after = to_cells.get(cell_id) or {}
        from_value = _round(before.get("value"), 6)
        to_value = _round(after.get("value"), 6)
        delta = _round(to_value - from_value, 6)
        rate = _round(_rate(delta, from_value), 6)
        if safe_view == "age_shift":
            before_label = str(before.get("label") or "-")
            after_label = str(after.get("label") or "-")
            changed = before_label != after_label
            key = "age_shift" if changed else "stable"
            label = f"{before_label} -> {after_label}" if changed else "主导年龄稳定"
            color = "#7c3aed" if changed else "#e5e7eb"
            opacity = 0.68 if changed else 0.34
            value = 1.0 if changed else 0.0
        else:
            stable = abs(delta) < POPULATION_STABLE_DELTA or abs(rate) < POPULATION_STABLE_RATE
            key, label, color, opacity = ("stable", "基本稳定", "#e5e7eb", 0.36) if stable else _diverging_cell(delta, rate, safe_view)
            value = rate * 100.0 if safe_view == "population_rate" else delta
        cells.append(
            {
                "cell_id": cell_id,
                "from_value": from_value,
                "to_value": to_value,
                "delta": delta,
                "rate": rate,
                "value": _round(value, 6),
                "class_key": key,
                "class_label": label,
                "fill_color": color,
                "stroke_color": "#64748b",
                "fill_opacity": opacity,
                "label": label if safe_view == "age_shift" else f"{label}: {_round(delta, 2)}",
            }
        )
    view_meta = POPULATION_VIEWS[safe_view]
    legend = _categorical_legend("主导年龄变化", [("age_shift", "主导年龄变化", "#7c3aed"), ("stable", "基本稳定", "#e5e7eb")]) if safe_view == "age_shift" else _continuous_legend(view_meta["label"], view_meta["unit"])
    summary = _summary_from_counts(cells)
    summary.update({"from_year": from_year, "to_year": to_year, "view": safe_view})
    return {
        "series": series,
        "periods": _periods(POPULATION_YEARS),
        "layer": {
            "period": f"{from_year}-{to_year}",
            "from_year": from_year,
            "to_year": to_year,
            "view": safe_view,
            "view_label": view_meta["label"],
            "summary": summary,
            "legend": legend,
            "features": features,
            "cells": cells,
        },
        "insights": [
            {"type": "population_delta", "title": "总人口变化", "value": summary["total_delta"], "unit": view_meta["unit"]},
            {"type": "population_grid", "title": "增长格网", "value": summary["increase_count"], "unit": "个"},
        ],
    }


def _nightlight_series(polygon: list, coord_type: str) -> list[dict[str, Any]]:
    series = []
    for year in NIGHTLIGHT_YEARS:
        overview = get_nightlight_overview(polygon, coord_type, year)
        summary = overview.get("summary") or {}
        series.append(
            {
                "year": int(year),
                "total_radiance": _round(summary.get("total_radiance"), 6),
                "mean_radiance": _round(summary.get("mean_radiance"), 6),
                "max_radiance": _round(summary.get("max_radiance"), 6),
                "lit_pixel_ratio": _round(summary.get("lit_pixel_ratio"), 6),
                "p90_radiance": _round(summary.get("p90_radiance"), 6),
            }
        )
    return series


def get_timeseries_nightlight(polygon: list, coord_type: str = "gcj02", period: str = "2023-2025", layer_view: str = "radiance_delta") -> dict[str, Any]:
    safe_view = layer_view if layer_view in NIGHTLIGHT_VIEWS else "radiance_delta"
    from_year_raw, to_year_raw = _parse_period(period, NIGHTLIGHT_YEARS)
    from_year, to_year = int(from_year_raw), int(to_year_raw)
    series = _nightlight_series(polygon, coord_type)
    grid = get_nightlight_grid(polygon, coord_type, year=to_year)
    features = grid.get("features") or []
    cell_ids = _feature_cell_ids(features)
    from_layer = get_nightlight_layer(polygon, coord_type, year=from_year, view="hotspot" if safe_view == "hotspot_shift" else "radiance")
    to_layer = get_nightlight_layer(polygon, coord_type, year=to_year, view="hotspot" if safe_view == "hotspot_shift" else "radiance")
    from_cells = _cell_map(from_layer)
    to_cells = _cell_map(to_layer)
    cells: list[dict[str, Any]] = []
    for cell_id in cell_ids:
        before = from_cells.get(cell_id) or {}
        after = to_cells.get(cell_id) or {}
        from_value = _round(before.get("value"), 6)
        to_value = _round(after.get("value"), 6)
        delta = _round(to_value - from_value, 6)
        rate = _round(_rate(delta, from_value), 6)
        if safe_view == "hotspot_shift":
            before_hot = bool(str(before.get("class_key") or "").endswith("hotspot"))
            after_hot = bool(str(after.get("class_key") or "").endswith("hotspot"))
            if before_hot and after_hot:
                key, label, color, opacity = "hotspot_stable", "热点保持", "#ef4444", 0.72
            elif (not before_hot) and after_hot:
                key, label, color, opacity = "hotspot_emerging", "新增热点", "#f59e0b", 0.72
            elif before_hot and not after_hot:
                key, label, color, opacity = "hotspot_faded", "热点减弱", "#38bdf8", 0.64
            else:
                key, label, color, opacity = "stable", "非热点稳定", "#e5e7eb", 0.32
            value = 1.0 if key != "stable" else 0.0
        elif safe_view == "lit_change":
            stable = abs(delta) < NIGHTLIGHT_STABLE_DELTA or abs(rate) < NIGHTLIGHT_STABLE_RATE
            if stable:
                key, label, color, opacity = "stable", "基本稳定", "#e5e7eb", 0.34
            elif delta > 0:
                key, label, color, opacity = "lit_brightened", "亮区增强", "#f97316", 0.68
            else:
                key, label, color, opacity = "lit_dimmed", "亮区减弱", "#2563eb", 0.64
            value = delta
        else:
            stable = abs(delta) < NIGHTLIGHT_STABLE_DELTA or abs(rate) < NIGHTLIGHT_STABLE_RATE
            key, label, color, opacity = ("stable", "基本稳定", "#e5e7eb", 0.34) if stable else _diverging_cell(delta, rate, safe_view)
            value = rate * 100.0 if safe_view == "radiance_rate" else delta
        cells.append(
            {
                "cell_id": cell_id,
                "from_value": from_value,
                "to_value": to_value,
                "delta": delta,
                "rate": rate,
                "value": _round(value, 6),
                "class_key": key,
                "class_label": label,
                "fill_color": color,
                "stroke_color": "#64748b",
                "fill_opacity": opacity,
                "label": label,
            }
        )
    view_meta = NIGHTLIGHT_VIEWS[safe_view]
    if safe_view == "hotspot_shift":
        legend = _categorical_legend("热点变化", [("hotspot_emerging", "新增热点", "#f59e0b"), ("hotspot_stable", "热点保持", "#ef4444"), ("hotspot_faded", "热点减弱", "#38bdf8"), ("stable", "非热点稳定", "#e5e7eb")])
    elif safe_view == "lit_change":
        legend = _categorical_legend("亮区变化", [("lit_brightened", "亮区增强", "#f97316"), ("lit_dimmed", "亮区减弱", "#2563eb"), ("stable", "基本稳定", "#e5e7eb")])
    else:
        legend = _continuous_legend(view_meta["label"], view_meta["unit"])
    summary = _summary_from_counts(cells)
    summary.update({"from_year": from_year, "to_year": to_year, "view": safe_view})
    return {
        "series": series,
        "periods": _periods(NIGHTLIGHT_YEARS),
        "layer": {
            "period": f"{from_year}-{to_year}",
            "from_year": from_year,
            "to_year": to_year,
            "view": safe_view,
            "view_label": view_meta["label"],
            "summary": summary,
            "legend": legend,
            "features": features,
            "cells": cells,
        },
        "insights": [
            {"type": "nightlight_delta", "title": "夜光总变化", "value": summary["total_delta"], "unit": view_meta["unit"]},
            {"type": "nightlight_grid", "title": "增强格网", "value": summary["increase_count"], "unit": "个"},
        ],
    }


def get_timeseries_joint(polygon: list, coord_type: str = "gcj02", period: str = "2024-2025") -> dict[str, Any]:
    from_year, to_year = _parse_period(period, COMMON_YEARS)
    if f"{from_year}-{to_year}" != "2024-2025":
        raise ValueError("joint timeseries currently supports 2024-2025 only")
    pop_grid = get_population_grid(polygon, coord_type, year=to_year)
    features = pop_grid.get("features") or []
    cell_ids = _feature_cell_ids(features)
    pop_from = _cell_map(get_population_layer(polygon, coord_type, year=from_year, view="overview"))
    pop_to = _cell_map(get_population_layer(polygon, coord_type, year=to_year, view="overview"))
    nl_from = _cell_map(get_nightlight_layer(polygon, coord_type, year=int(from_year), view="radiance"))
    nl_to = _cell_map(get_nightlight_layer(polygon, coord_type, year=int(to_year), view="radiance"))
    classes = {
        "pop_up_light_up": ("人口增夜光增", "#b91c1c", 0.76),
        "pop_up_light_down": ("人口增夜光降", "#f59e0b", 0.70),
        "pop_down_light_up": ("人口降夜光增", "#7c3aed", 0.70),
        "pop_down_light_down": ("人口降夜光降", "#2563eb", 0.68),
        "joint_stable": ("基本稳定", "#e5e7eb", 0.34),
    }
    cells: list[dict[str, Any]] = []
    for cell_id in cell_ids:
        pop_before = _round((pop_from.get(cell_id) or {}).get("value"), 6)
        pop_after = _round((pop_to.get(cell_id) or {}).get("value"), 6)
        nl_before = _round((nl_from.get(cell_id) or {}).get("value"), 6)
        nl_after = _round((nl_to.get(cell_id) or {}).get("value"), 6)
        pop_delta = _round(pop_after - pop_before, 6)
        nl_delta = _round(nl_after - nl_before, 6)
        pop_rate = _round(_rate(pop_delta, pop_before), 6)
        nl_rate = _round(_rate(nl_delta, nl_before), 6)
        pop_stable = abs(pop_delta) < POPULATION_STABLE_DELTA or abs(pop_rate) < POPULATION_STABLE_RATE
        nl_stable = abs(nl_delta) < NIGHTLIGHT_STABLE_DELTA or abs(nl_rate) < NIGHTLIGHT_STABLE_RATE
        if pop_stable or nl_stable:
            key = "joint_stable"
        elif pop_delta > 0 and nl_delta > 0:
            key = "pop_up_light_up"
        elif pop_delta > 0 and nl_delta < 0:
            key = "pop_up_light_down"
        elif pop_delta < 0 and nl_delta > 0:
            key = "pop_down_light_up"
        else:
            key = "pop_down_light_down"
        label, color, opacity = classes[key]
        cells.append(
            {
                "cell_id": cell_id,
                "from_value": pop_before,
                "to_value": pop_after,
                "delta": pop_delta,
                "rate": pop_rate,
                "nightlight_from_value": nl_before,
                "nightlight_to_value": nl_after,
                "nightlight_delta": nl_delta,
                "nightlight_rate": nl_rate,
                "value": pop_delta,
                "class_key": key,
                "class_label": label,
                "fill_color": color,
                "stroke_color": "#64748b",
                "fill_opacity": opacity,
                "label": label,
            }
        )
    summary = _summary_from_counts(cells)
    summary.update({"from_year": from_year, "to_year": to_year, "view": "joint_quadrant"})
    return {
        "series": [
            {
                "year": int(year),
                "population": _round((get_population_overview(polygon, coord_type, str(year)).get("summary") or {}).get("total_population"), 3),
                "total_radiance": _round((get_nightlight_overview(polygon, coord_type, int(year)).get("summary") or {}).get("total_radiance"), 6),
            }
            for year in COMMON_YEARS
        ],
        "periods": [{"value": "2024-2025", "label": "2024 -> 2025", "from_year": "2024", "to_year": "2025"}],
        "layer": {
            "period": "2024-2025",
            "from_year": "2024",
            "to_year": "2025",
            "view": "joint_quadrant",
            "view_label": "人口-夜光四象限",
            "summary": summary,
            "legend": _categorical_legend("人口-夜光关系", [(key, value[0], value[1]) for key, value in classes.items()]),
            "features": features,
            "cells": cells,
        },
        "insights": [
            {"type": "joint_quadrant", "title": "人口增夜光增", "value": summary["class_counts"].get("pop_up_light_up", 0), "unit": "个"},
            {"type": "joint_stable", "title": "基本稳定", "value": summary["class_counts"].get("joint_stable", 0), "unit": "个"},
        ],
    }
