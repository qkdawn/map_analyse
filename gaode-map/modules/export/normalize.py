from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Sequence


def json_safe_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): json_safe_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe_value(v) for v in value]
    return str(value)


def json_safe_dict(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {str(k): json_safe_value(v) for k, v in value.items()}


def normalize_optional_float(value: Any) -> Any:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return ""
    if num != num:
        return ""
    return num


def normalize_optional_int(value: Any) -> Any:
    try:
        return int(value)
    except (TypeError, ValueError):
        return ""


def encode_json_bytes(value: Any) -> bytes:
    return json.dumps(json_safe_value(value), ensure_ascii=False, indent=2).encode("utf-8")


def normalize_position(raw: Any) -> Optional[List[float]]:
    if not isinstance(raw, (list, tuple)) or len(raw) < 2:
        return None
    try:
        lng = float(raw[0])
        lat = float(raw[1])
    except (TypeError, ValueError):
        return None
    if not (lng == lng and lat == lat):
        return None
    return [lng, lat]


def normalize_line(raw: Any) -> Optional[List[List[float]]]:
    if not isinstance(raw, list):
        return None
    points: List[List[float]] = []
    for item in raw:
        point = normalize_position(item)
        if point:
            points.append(point)
    if len(points) < 2:
        return None
    return points


def normalize_ring(raw: Any) -> Optional[List[List[float]]]:
    line = normalize_line(raw)
    if not line or len(line) < 3:
        return None
    first = line[0]
    last = line[-1]
    if first[0] != last[0] or first[1] != last[1]:
        line.append([first[0], first[1]])
    if len(line) < 4:
        return None
    return line


def normalize_polygon(raw: Any) -> Optional[List[List[List[float]]]]:
    if not isinstance(raw, list):
        return None
    rings: List[List[List[float]]] = []
    for item in raw:
        ring = normalize_ring(item)
        if ring:
            rings.append(ring)
    if not rings:
        return None
    return rings


def normalize_geometry(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    geom_type = str(raw.get("type") or "")
    coords = raw.get("coordinates")
    if geom_type == "Point":
        point = normalize_position(coords)
        return {"type": "Point", "coordinates": point} if point else None
    if geom_type == "LineString":
        line = normalize_line(coords)
        return {"type": "LineString", "coordinates": line} if line else None
    if geom_type == "MultiLineString":
        lines: List[List[List[float]]] = []
        for item in coords if isinstance(coords, list) else []:
            line = normalize_line(item)
            if line:
                lines.append(line)
        return {"type": "MultiLineString", "coordinates": lines} if lines else None
    if geom_type == "Polygon":
        polygon = normalize_polygon(coords)
        return {"type": "Polygon", "coordinates": polygon} if polygon else None
    if geom_type == "MultiPolygon":
        polygons: List[List[List[List[float]]]] = []
        for item in coords if isinstance(coords, list) else []:
            polygon = normalize_polygon(item)
            if polygon:
                polygons.append(polygon)
        return {"type": "MultiPolygon", "coordinates": polygons} if polygons else None
    return None


def normalize_feature(
    raw: Any,
    *,
    allowed_geometry_types: Optional[set[str]] = None,
) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict) or str(raw.get("type") or "") != "Feature":
        return None
    geometry = normalize_geometry(raw.get("geometry"))
    if not geometry:
        return None
    if allowed_geometry_types and geometry.get("type") not in allowed_geometry_types:
        return None
    properties = json_safe_dict(raw.get("properties") if isinstance(raw.get("properties"), dict) else {})
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def normalize_feature_list(
    features: Sequence[Dict[str, Any]],
    *,
    allowed_geometry_types: Optional[set[str]] = None,
) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for item in features or []:
        feature = normalize_feature(item, allowed_geometry_types=allowed_geometry_types)
        if feature:
            result.append(feature)
    return result


def normalize_poi_rows(source: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in source or []:
        if not isinstance(item, dict):
            continue
        point = normalize_position(item.get("location"))
        if not point:
            continue
        rows.append(
            {
                "id": str(item.get("id") or ""),
                "name": str(item.get("name") or ""),
                "type": str(item.get("type") or ""),
                "category": str(item.get("category") or item.get("category_name") or ""),
                "lng": point[0],
                "lat": point[1],
                "address": str(item.get("address") or ""),
                "distance": normalize_optional_float(item.get("distance")),
                "source": str(item.get("source") or ""),
            }
        )
    return rows
