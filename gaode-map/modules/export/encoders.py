from __future__ import annotations

import base64
import csv
import json
from io import StringIO
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .normalize import json_safe_dict, json_safe_value, normalize_optional_float, normalize_optional_int

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def build_poi_category_summary(rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    bucket: Dict[str, int] = {}
    for row in rows or []:
        key = str(row.get("category") or row.get("type") or "未分类").strip() or "未分类"
        bucket[key] = int(bucket.get(key, 0)) + 1
    total = max(1, len(rows or []))
    ranked = sorted(bucket.items(), key=lambda item: item[1], reverse=True)
    return [{"category": name, "count": count, "ratio": round(count / total, 6)} for name, count in ranked]


def build_csv_bytes(rows: Sequence[Dict[str, Any]], *, headers: List[str]) -> bytes:
    stream = StringIO()
    writer = csv.DictWriter(stream, fieldnames=headers, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: row.get(key, "") for key in headers})
    return stream.getvalue().encode("utf-8")


def build_poi_csv(rows: Sequence[Dict[str, Any]]) -> bytes:
    headers = ["id", "name", "type", "category", "lng", "lat", "address", "distance", "source"]
    return build_csv_bytes(rows, headers=headers)


def build_h3_summary_rows(features: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for feature in features or []:
        props = feature.get("properties") if isinstance(feature, dict) else {}
        if not isinstance(props, dict):
            props = {}
        rows.append(
            {
                "h3_id": str(props.get("h3_id") or ""),
                "poi_count": normalize_optional_int(props.get("poi_count")),
                "density_poi_per_km2": normalize_optional_float(props.get("density_poi_per_km2")),
                "local_entropy": normalize_optional_float(props.get("local_entropy")),
                "neighbor_mean_density": normalize_optional_float(props.get("neighbor_mean_density")),
                "neighbor_mean_entropy": normalize_optional_float(props.get("neighbor_mean_entropy")),
                "neighbor_count": normalize_optional_int(props.get("neighbor_count")),
                "gi_star_z_score": normalize_optional_float(props.get("gi_star_z_score")),
                "lisa_i": normalize_optional_float(props.get("lisa_i")),
                "category_counts": json.dumps(json_safe_dict(props.get("category_counts") or {}), ensure_ascii=False),
            }
        )
    return rows


def build_summary_rows(summary: Dict[str, Any]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []
    for key in sorted(summary.keys()):
        value = summary.get(key)
        if isinstance(value, (dict, list)):
            value_text = json.dumps(json_safe_value(value), ensure_ascii=False)
        else:
            value_text = "" if value is None else str(value)
        rows.append({"key": str(key), "value": value_text})
    return rows


def decode_png_base64(raw: Optional[str]) -> Optional[bytes]:
    text = str(raw or "").strip()
    if not text:
        return None
    if text.startswith("data:"):
        marker = "base64,"
        idx = text.find(marker)
        if idx < 0:
            return None
        prefix = text[: idx + len(marker)].lower()
        if "image/png" not in prefix:
            return None
        text = text[idx + len(marker) :]
    try:
        data = base64.b64decode(text, validate=True)
    except Exception:
        return None
    if not data.startswith(PNG_MAGIC):
        return None
    return data


def build_frontend_chart_files(
    frontend_charts: Sequence[Any],
    file_paths: Dict[str, str],
) -> Tuple[List[Tuple[str, bytes]], List[str]]:
    chart_files: List[Tuple[str, bytes]] = []
    skipped_chart_ids: List[str] = []
    seen_ids: set[str] = set()
    for item in frontend_charts or []:
        chart_id = str(getattr(item, "chart_id", "") or "").strip()
        if not chart_id or chart_id in seen_ids:
            continue
        seen_ids.add(chart_id)
        path = file_paths.get(chart_id)
        if not path:
            continue
        png_bytes = decode_png_base64(getattr(item, "png_base64", None))
        if not png_bytes:
            skipped_chart_ids.append(chart_id)
            continue
        chart_files.append((path, png_bytes))
    return chart_files, skipped_chart_ids


def extract_frontend_panel_png(panel_id: str, frontend_panels: Sequence[Any]) -> Optional[bytes]:
    target_id = str(panel_id or "").strip()
    if not target_id:
        return None
    for item in frontend_panels or []:
        current_id = str(getattr(item, "panel_id", "") or "").strip()
        if current_id != target_id:
            continue
        return decode_png_base64(getattr(item, "png_base64", None))
    return None


def pois_to_features(rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    features: List[Dict[str, Any]] = []
    for row in rows or []:
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row["lng"], row["lat"]]},
                "properties": {
                    "id": row.get("id", ""),
                    "name": row.get("name", ""),
                    "type": row.get("type", ""),
                    "category": row.get("category", ""),
                    "address": row.get("address", ""),
                    "distance": row.get("distance", ""),
                    "source": row.get("source", ""),
                },
            }
        )
    return features
