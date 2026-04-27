from __future__ import annotations

from typing import Any, Iterable

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
    "density_delta": {"label": "人口密度变化", "unit": "人/平方公里"},
    "age_shift": {"label": "主导年龄段迁移", "unit": "类别"},
}
NIGHTLIGHT_VIEWS = {
    "radiance_delta": {"label": "夜光辐射变化量", "unit": "nWatts/(cm^2 sr)"},
    "radiance_rate": {"label": "夜光辐射变化率", "unit": "%"},
    "hotspot_shift": {"label": "热点迁移", "unit": "类别"},
    "lit_change": {"label": "亮灯强度变化", "unit": "类别"},
}


def round_metric(value: Any, digits: int = 6) -> float:
    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return 0.0


def build_periods(years: Iterable[Any]) -> list[dict[str, Any]]:
    items = [str(item) for item in years]
    result: list[dict[str, Any]] = []
    for idx in range(len(items) - 1):
        start, end = items[idx], items[idx + 1]
        result.append({"value": f"{start}-{end}", "label": f"{start} -> {end}", "from_year": start, "to_year": end})
    if len(items) > 2:
        start, end = items[0], items[-1]
        result.append({"value": f"{start}-{end}", "label": f"{start} -> {end}", "from_year": start, "to_year": end})
    return result


def parse_period(period: str, valid_years: Iterable[Any]) -> tuple[str, str]:
    years = [str(item) for item in valid_years]
    raw = str(period or "").strip()
    parts = [item.strip() for item in (raw.split("->", 1) if "->" in raw else raw.split("-", 1))]
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError(f"invalid timeseries period: {period}")
    start, end = parts[0], parts[1]
    if start not in years or end not in years:
        raise ValueError(f"period years must be in {', '.join(years)}")
    if years.index(start) >= years.index(end):
        raise ValueError("period start year must be earlier than end year")
    return start, end


def build_cell_map(layer: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(cell.get("cell_id") or ""): cell
        for cell in (layer.get("cells") or [])
        if str(cell.get("cell_id") or "")
    }


def extract_feature_cell_ids(features: list[dict[str, Any]]) -> list[str]:
    ids: list[str] = []
    for feature in features:
        props = (feature or {}).get("properties") or {}
        cell_id = str(props.get("cell_id") or props.get("h3_id") or "")
        if cell_id:
            ids.append(cell_id)
    return ids


def calc_rate(delta: float, base: float) -> float:
    return float(delta) / float(base) if abs(float(base)) > 1e-9 else 0.0


def build_diverging_cell(delta: float, rate: float, view: str) -> tuple[str, str, str, float]:
    if abs(delta) < 1e-9:
        return "stable", "变化平稳", "#e5e7eb", 0.38
    if delta > 0:
        if abs(rate) >= 0.20:
            return "strong_increase", "显著增长", "#b91c1c", 0.78
        return "increase", "增长", "#f97316", 0.66
    if view.endswith("_rate") and abs(rate) >= 0.20:
        return "strong_decrease", "显著下降", "#1d4ed8", 0.78
    return "decrease", "下降", "#38bdf8", 0.62


def build_continuous_legend(title: str, unit: str) -> dict[str, Any]:
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


def build_categorical_legend(title: str, items: list[tuple[str, str, str]]) -> dict[str, Any]:
    return {
        "title": title,
        "kind": "categorical",
        "unit": "类别",
        "min_value": 0.0,
        "max_value": 0.0,
        "stops": [
            {"ratio": 0.0, "color": color, "value": 0.0, "label": label, "key": key}
            for key, label, color in items
        ],
    }


def build_summary_from_counts(cells: list[dict[str, Any]]) -> dict[str, Any]:
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
        "total_delta": round_metric(sum(deltas), 3),
        "average_rate": round_metric(sum(rates) / len(rates), 6) if rates else 0.0,
    }
