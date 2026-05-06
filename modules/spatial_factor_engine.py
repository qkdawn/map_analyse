from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Any, Dict, Iterable, List, Optional, Tuple


SPATIAL_FACTOR_VERSION = "multi_mode_v1"

_DIRECTIONS = [
    ("north", "北"),
    ("northeast", "东北"),
    ("east", "东"),
    ("southeast", "东南"),
    ("south", "南"),
    ("southwest", "西南"),
    ("west", "西"),
    ("northwest", "西北"),
]

_DIRECTION_INDEX = {key: idx for idx, (key, _label) in enumerate(_DIRECTIONS)}
_DIRECTION_LABELS = dict(_DIRECTIONS)

_ORIENTATION_LABELS = {
    "east_west": "东西向",
    "north_south": "南北向",
    "northeast_southwest": "东北-西南向",
    "northwest_southeast": "西北-东南向",
}

_ORIENTATION_DIRECTION_KEYS = {
    "east_west": {"east", "west"},
    "north_south": {"north", "south"},
    "northeast_southwest": {"northeast", "southwest"},
    "northwest_southeast": {"northwest", "southeast"},
}


def safe_round(value: float, digits: int = 6) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(number):
        return 0.0
    return round(number, digits)


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    radius = 6371008.8
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    d_phi = math.radians(float(lat2) - float(lat1))
    d_lambda = math.radians(float(lon2) - float(lon1))
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    return 2.0 * radius * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def classify_axis_orientation(lon1: float, lat1: float, lon2: float, lat2: float) -> str:
    dx = float(lon2) - float(lon1)
    dy = float(lat2) - float(lat1)
    if abs(dx) <= 1e-12 and abs(dy) <= 1e-12:
        return ""
    angle = (math.degrees(math.atan2(dy, dx)) + 180.0) % 180.0
    if angle < 22.5 or angle >= 157.5:
        return "east_west"
    if angle < 67.5:
        return "northeast_southwest"
    if angle < 112.5:
        return "north_south"
    return "northwest_southeast"


def _to_float(value: Any) -> Optional[float]:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _as_text(value: Any) -> str:
    return str(value or "").strip()


def _first_number(raw: Dict[str, Any], keys: Iterable[str]) -> Optional[float]:
    for key in keys:
        value = _to_float(raw.get(key))
        if value is not None:
            return value
    return None


def _feature_props(raw: Dict[str, Any]) -> Dict[str, Any]:
    props = raw.get("properties")
    return props if isinstance(props, dict) else {}


def _geometry(raw: Dict[str, Any]) -> Dict[str, Any]:
    geom = raw.get("geometry")
    return geom if isinstance(geom, dict) else {}


def _coords_centroid(coords: Any) -> Optional[List[float]]:
    points: List[List[float]] = []

    def collect(value: Any) -> None:
        if isinstance(value, (list, tuple)) and len(value) >= 2 and _to_float(value[0]) is not None and _to_float(value[1]) is not None:
            points.append([float(value[0]), float(value[1])])
            return
        if isinstance(value, (list, tuple)):
            for item in value:
                collect(item)

    collect(coords)
    if not points:
        return None
    return [
        safe_round(sum(point[0] for point in points) / len(points), 6),
        safe_round(sum(point[1] for point in points) / len(points), 6),
    ]


def _extract_lng_lat(raw: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    lng = _to_float(raw.get("lng"))
    lat = _to_float(raw.get("lat"))
    if lng is not None and lat is not None:
        return lng, lat
    location = raw.get("location")
    if isinstance(location, (list, tuple)) and len(location) >= 2:
        lng = _to_float(location[0])
        lat = _to_float(location[1])
        if lng is not None and lat is not None:
            return lng, lat
    centroid = raw.get("centroid_gcj02") or raw.get("centroid")
    if isinstance(centroid, (list, tuple)) and len(centroid) >= 2:
        lng = _to_float(centroid[0])
        lat = _to_float(centroid[1])
        if lng is not None and lat is not None:
            return lng, lat
    props = _feature_props(raw)
    centroid = props.get("centroid_gcj02") or props.get("centroid")
    if isinstance(centroid, (list, tuple)) and len(centroid) >= 2:
        lng = _to_float(centroid[0])
        lat = _to_float(centroid[1])
        if lng is not None and lat is not None:
            return lng, lat
    geom = _geometry(raw)
    if geom.get("type") == "Point":
        coords = geom.get("coordinates") or []
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            lng = _to_float(coords[0])
            lat = _to_float(coords[1])
            if lng is not None and lat is not None:
                return lng, lat
    centroid = _coords_centroid(geom.get("coordinates"))
    if centroid:
        return float(centroid[0]), float(centroid[1])
    return None


def _normalize_point(raw: Any, subject_key: Optional[str] = None, value_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    lng_lat = _extract_lng_lat(raw)
    if lng_lat is None:
        return None
    props = _feature_props(raw)
    merged = {**props, **raw}
    subject = _as_text(merged.get(subject_key or "subcategory") or merged.get("subcategory") or merged.get("category"))
    value = _to_float(merged.get(value_key)) if value_key else None
    if value is None:
        value = _first_number(merged, ("value", "raw_value", "display_value", "total_radiance", "population", "poi_count", "count"))
    return {
        "lng": float(lng_lat[0]),
        "lat": float(lng_lat[1]),
        "subject": subject or "未分类",
        "category": _as_text(merged.get("category")),
        "subcategory": _as_text(merged.get("subcategory")) or subject or "未分类小类",
        "area": _as_text(merged.get("area") or merged.get("adname") or merged.get("region")) or "未知区域",
        "value": value if value is not None else 1.0,
        "source": raw,
    }


def _normalize_points(points: Iterable[Any], subject_key: Optional[str] = None, value_key: Optional[str] = None) -> List[Dict[str, Any]]:
    return [
        point
        for point in (_normalize_point(item, subject_key=subject_key, value_key=value_key) for item in points or [])
        if point is not None
    ]


def _normalize_grid(items: Iterable[Any], subject_key: Optional[str] = None, value_key: Optional[str] = None) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in items or []:
        point = _normalize_point(item, subject_key=subject_key, value_key=value_key)
        if point is None:
            continue
        raw = item if isinstance(item, dict) else {}
        props = _feature_props(raw)
        merged = {**props, **raw}
        value = _to_float(merged.get(value_key)) if value_key else None
        if value is None:
            value = _first_number(
                merged,
                (
                    "value",
                    "raw_value",
                    "display_value",
                    "total_radiance",
                    "mean_radiance",
                    "population",
                    "selected_population",
                    "density_poi_per_km2",
                    "poi_count",
                    "count",
                ),
            )
        point["value"] = max(0.0, float(value if value is not None else 1.0))
        point["cell_id"] = _as_text(merged.get("cell_id") or merged.get("h3_id") or merged.get("id"))
        rows.append(point)
    return rows


def _iter_line_coordinate_lists(geometry: Dict[str, Any]) -> Iterable[List[Any]]:
    geom_type = geometry.get("type")
    coords = geometry.get("coordinates") or []
    if geom_type == "LineString":
        yield list(coords)
    elif geom_type == "MultiLineString":
        for line in coords:
            if isinstance(line, (list, tuple)):
                yield list(line)


def _normalize_line_segments(items: Iterable[Any]) -> List[Dict[str, Any]]:
    segments: List[Dict[str, Any]] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        geometry = _geometry(item)
        for coords in _iter_line_coordinate_lists(geometry):
            clean: List[List[float]] = []
            for coord in coords:
                if isinstance(coord, (list, tuple)) and len(coord) >= 2:
                    lng = _to_float(coord[0])
                    lat = _to_float(coord[1])
                    if lng is not None and lat is not None:
                        clean.append([lng, lat])
            for a, b in zip(clean, clean[1:]):
                length_m = haversine_m(a[0], a[1], b[0], b[1])
                if length_m <= 0:
                    continue
                orientation = classify_axis_orientation(a[0], a[1], b[0], b[1])
                segments.append(
                    {
                        "lng": (a[0] + b[0]) / 2.0,
                        "lat": (a[1] + b[1]) / 2.0,
                        "value": length_m / 1000.0,
                        "length_km": length_m / 1000.0,
                        "edge_count": 1,
                        "orientation": orientation,
                        "start": a,
                        "end": b,
                    }
                )
    return segments


def _normalize_polygons(items: Iterable[Any]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        geometry = _geometry(item)
        coords = geometry.get("coordinates")
        if not coords and item.get("coordinates"):
            coords = item.get("coordinates")
            geometry = {"type": "Polygon", "coordinates": coords}
        centroid = _coords_centroid(coords)
        if not centroid:
            continue
        area_score = _polygon_area_score(coords)
        rows.append(
            {
                "lng": float(centroid[0]),
                "lat": float(centroid[1]),
                "value": max(1e-9, area_score),
                "area_score": area_score,
                "geometry": geometry,
            }
        )
    return rows


def _polygon_area_score(coords: Any) -> float:
    rings = coords
    if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (list, tuple)):
        if coords and coords[0] and isinstance(coords[0][0], (list, tuple)) and len(coords[0][0]) >= 2:
            rings = coords
    if not isinstance(rings, (list, tuple)) or not rings:
        return 0.0
    ring = rings[0] if isinstance(rings[0], (list, tuple)) and rings[0] and isinstance(rings[0][0], (list, tuple)) else rings
    points: List[List[float]] = []
    for coord in ring:
        if isinstance(coord, (list, tuple)) and len(coord) >= 2:
            lng = _to_float(coord[0])
            lat = _to_float(coord[1])
            if lng is not None and lat is not None:
                points.append([lng, lat])
    if len(points) < 3:
        return 0.0
    area = 0.0
    for a, b in zip(points, points[1:] + points[:1]):
        area += (a[0] * b[1]) - (b[0] * a[1])
    return abs(area) / 2.0


def _resolve_center(points: List[Dict[str, Any]], center: Optional[List[float]] = None) -> List[float]:
    if isinstance(center, (list, tuple)) and len(center) >= 2:
        lng = _to_float(center[0])
        lat = _to_float(center[1])
        if lng is not None and lat is not None:
            return [safe_round(lng, 6), safe_round(lat, 6)]
    centroid = _centroid(points)
    return centroid


def _direction_key_for_point(lng: float, lat: float, center: List[float]) -> str:
    if len(center) < 2:
        return ""
    dx = float(lng) - float(center[0])
    dy = float(lat) - float(center[1])
    if abs(dx) <= 1e-12 and abs(dy) <= 1e-12:
        return "north"
    bearing = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0
    idx = int(((bearing + 22.5) % 360.0) // 45.0)
    return _DIRECTIONS[idx][0]


def _direction_label(key: str) -> str:
    return _DIRECTION_LABELS.get(key, "")


def _centroid(points: List[Dict[str, Any]]) -> List[float]:
    if not points:
        return []
    weight_sum = sum(max(0.0, float(item.get("value") or 1.0)) for item in points)
    if weight_sum <= 1e-9:
        weight_sum = float(len(points))
        return [
            safe_round(sum(float(item["lng"]) for item in points) / weight_sum, 6),
            safe_round(sum(float(item["lat"]) for item in points) / weight_sum, 6),
        ]
    return [
        safe_round(sum(float(item["lng"]) * max(0.0, float(item.get("value") or 1.0)) for item in points) / weight_sum, 6),
        safe_round(sum(float(item["lat"]) * max(0.0, float(item.get("value") or 1.0)) for item in points) / weight_sum, 6),
    ]


def _centroid_factor(points: List[Dict[str, Any]], center: List[float]) -> Dict[str, Any]:
    centroid = _centroid(points)
    if len(centroid) < 2 or len(center) < 2:
        return {"centroid": centroid, "direction_from_center": "", "distance_from_center_m": 0.0}
    direction_key = _direction_key_for_point(centroid[0], centroid[1], center)
    return {
        "centroid": centroid,
        "direction_from_center": _direction_label(direction_key),
        "distance_from_center_m": safe_round(haversine_m(center[0], center[1], centroid[0], centroid[1]), 2),
    }


def _direction_factor(points: List[Dict[str, Any]], center: List[float]) -> Dict[str, Any]:
    rows = {
        key: {"key": key, "label": label, "count": 0, "value": 0.0, "share": 0.0}
        for key, label in _DIRECTIONS
    }
    for point in points:
        key = _direction_key_for_point(float(point["lng"]), float(point["lat"]), center)
        if not key:
            continue
        rows[key]["count"] += 1
        rows[key]["value"] += max(0.0, float(point.get("value") or 1.0))
    total_value = sum(float(item["value"]) for item in rows.values())
    total_count = sum(int(item["count"]) for item in rows.values())
    for item in rows.values():
        item["value"] = safe_round(float(item["value"]), 6)
        item["share"] = safe_round(float(item["value"]) / total_value, 6) if total_value > 1e-9 else 0.0
    ranked = sorted(rows.values(), key=lambda item: (float(item["value"]), int(item["count"])), reverse=True)
    dominant = ranked[0] if ranked and (ranked[0]["count"] or ranked[0]["value"]) else {}
    secondary = ranked[1] if len(ranked) > 1 and (ranked[1]["count"] or ranked[1]["value"]) else {}
    return {
        "dominant_direction": str(dominant.get("label") or ""),
        "secondary_direction": str(secondary.get("label") or ""),
        "dominant_direction_key": str(dominant.get("key") or ""),
        "secondary_direction_key": str(secondary.get("key") or ""),
        "dominant_share": float(dominant.get("share") or 0.0),
        "secondary_share": float(secondary.get("share") or 0.0),
        "direction_rows": list(rows.values()),
        "point_count": total_count,
    }


def _ring_factor(points: List[Dict[str, Any]], center: List[float]) -> Dict[str, Any]:
    buckets = {
        "core": {"key": "core", "label": "核心圈层", "count": 0, "value": 0.0, "share": 0.0, "value_share": 0.0, "max_distance_m": 0.0},
        "middle": {"key": "middle", "label": "中圈层", "count": 0, "value": 0.0, "share": 0.0, "value_share": 0.0, "max_distance_m": 0.0},
        "outer": {"key": "outer", "label": "外围圈层", "count": 0, "value": 0.0, "share": 0.0, "value_share": 0.0, "max_distance_m": 0.0},
    }
    if len(center) < 2 or not points:
        return {"dominant_ring": "", "dominant_share": 0.0, "ring_rows": list(buckets.values()), "max_distance_m": 0.0}
    distances = [haversine_m(center[0], center[1], float(item["lng"]), float(item["lat"])) for item in points]
    max_distance = max(distances) if distances else 0.0
    core_threshold = max_distance / 3.0
    middle_threshold = max_distance * 2.0 / 3.0
    for point, distance in zip(points, distances):
        if max_distance <= 1e-9 or distance <= core_threshold:
            key = "core"
        elif distance <= middle_threshold:
            key = "middle"
        else:
            key = "outer"
        buckets[key]["count"] += 1
        buckets[key]["value"] += max(0.0, float(point.get("value") or 1.0))
        buckets[key]["max_distance_m"] = max(float(buckets[key]["max_distance_m"]), distance)
    total_count = max(1, len(points))
    total_value = sum(float(item["value"]) for item in buckets.values())
    for item in buckets.values():
        item["value"] = safe_round(float(item["value"]), 6)
        item["share"] = safe_round(int(item["count"]) / total_count, 6)
        item["value_share"] = safe_round(float(item["value"]) / total_value, 6) if total_value > 1e-9 else 0.0
        item["max_distance_m"] = safe_round(float(item["max_distance_m"]), 2)
    ranked = sorted(buckets.values(), key=lambda item: (float(item["value"]), int(item["count"])), reverse=True)
    dominant = ranked[0] if ranked and int(ranked[0]["count"]) > 0 else {}
    return {
        "dominant_ring": str(dominant.get("label") or ""),
        "dominant_share": float(dominant.get("share") or 0.0),
        "dominant_value_share": float(dominant.get("value_share") or 0.0),
        "ring_rows": list(buckets.values()),
        "max_distance_m": safe_round(max_distance, 2),
    }


def _hotspot_factor(points: List[Dict[str, Any]], center: List[float], grid_size: int = 4) -> Dict[str, Any]:
    if not points:
        return {"hotspot_grid_count": 0, "dominant_hotspot_direction": "", "hotspot_pattern": "none", "grid_rows": []}
    lngs = [float(item["lng"]) for item in points]
    lats = [float(item["lat"]) for item in points]
    min_lng, max_lng = min(lngs), max(lngs)
    min_lat, max_lat = min(lats), max(lats)
    span_lng = max(max_lng - min_lng, 1e-9)
    span_lat = max(max_lat - min_lat, 1e-9)
    grid_counts: Dict[Tuple[int, int], Dict[str, Any]] = {}
    for point in points:
        gx = min(grid_size - 1, max(0, int(((float(point["lng"]) - min_lng) / span_lng) * grid_size)))
        gy = min(grid_size - 1, max(0, int(((float(point["lat"]) - min_lat) / span_lat) * grid_size)))
        cell = grid_counts.setdefault((gx, gy), {"gx": gx, "gy": gy, "count": 0, "value": 0.0, "points": []})
        cell["count"] += 1
        cell["value"] += max(0.0, float(point.get("value") or 1.0))
        cell["points"].append(point)
    values = sorted([float(item["value"]) for item in grid_counts.values()], reverse=True)
    if not values:
        threshold = 0.0
    elif len(points) < 8:
        threshold = values[0]
    else:
        threshold = max(2.0, values[max(0, min(len(values) - 1, len(values) // 4))])
    hotspots = [item for item in grid_counts.values() if float(item["value"]) >= threshold and float(item["value"]) > 0]
    rows = []
    direction_counter: Counter[str] = Counter()
    for item in hotspots:
        centroid = _centroid(item["points"])
        direction_key = _direction_key_for_point(centroid[0], centroid[1], center) if len(centroid) >= 2 else ""
        direction_counter[direction_key] += float(item["value"])
        rows.append(
            {
                "grid_key": f"{item['gx']},{item['gy']}",
                "count": int(item["count"]),
                "value": safe_round(float(item["value"]), 6),
                "centroid": centroid,
                "direction": _direction_label(direction_key),
            }
        )
    dominant_key = direction_counter.most_common(1)[0][0] if direction_counter else ""
    if not hotspots:
        pattern = "none"
    elif len(hotspots) == 1:
        pattern = "single_core"
    elif len(hotspots) <= 3:
        pattern = "multi_core"
    else:
        pattern = "dispersed_hotspots"
    return {
        "hotspot_grid_count": len(hotspots),
        "dominant_hotspot_direction": _direction_label(dominant_key),
        "dominant_hotspot_direction_key": dominant_key,
        "hotspot_pattern": pattern,
        "grid_rows": sorted(rows, key=lambda item: (float(item["value"]), int(item["count"])), reverse=True)[:8],
    }


def _orientation_factor(segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    buckets = {
        key: {"key": key, "label": label, "length_km": 0.0, "length_share": 0.0, "edge_count": 0}
        for key, label in _ORIENTATION_LABELS.items()
    }
    for segment in segments:
        key = str(segment.get("orientation") or "")
        if key not in buckets:
            continue
        buckets[key]["length_km"] += max(0.0, float(segment.get("length_km") or 0.0))
        buckets[key]["edge_count"] += int(segment.get("edge_count") or 1)
    total_length = sum(float(item["length_km"]) for item in buckets.values())
    for item in buckets.values():
        item["length_km"] = safe_round(float(item["length_km"]), 4)
        item["length_share"] = safe_round(float(item["length_km"]) / total_length, 6) if total_length > 1e-9 else 0.0
    rows = list(buckets.values())
    ranked = sorted(rows, key=lambda item: (float(item["length_km"]), int(item["edge_count"])), reverse=True)
    dominant = ranked[0] if ranked and float(ranked[0]["length_km"]) > 0 else {}
    secondary = ranked[1] if len(ranked) > 1 and float(ranked[1]["length_km"]) > 0 else {}
    return {
        "dominant_orientation": str(dominant.get("label") or ""),
        "secondary_orientation": str(secondary.get("label") or ""),
        "dominant_orientation_key": str(dominant.get("key") or ""),
        "secondary_orientation_key": str(secondary.get("key") or ""),
        "dominant_share": float(dominant.get("length_share") or 0.0),
        "secondary_share": float(secondary.get("length_share") or 0.0),
        "orientation_rows": rows,
        "total_length_km": safe_round(total_length, 4),
    }


def _empty_proximity_factor() -> Dict[str, Any]:
    return {
        "center_distance_m": 0.0,
        "nearest_hotspot_distance_m": 0.0,
        "nearest_road_distance_m": 0.0,
        "nearby_poi_count": 0,
        "nearby_category_count": 0,
        "nearby_competitor_count": 0,
        "poi_mix_radius_m": 0.0,
    }


def _empty_road_proximity_factor() -> Dict[str, Any]:
    return {
        "nearest_road_distance_m": 0.0,
        "mean_nearest_road_distance_m": 0.0,
        "within_100m_share": 0.0,
        "road_feature_count": 0,
    }


def _nearest_distance(point: Dict[str, Any], candidates: List[Dict[str, Any]]) -> float:
    if not point or not candidates:
        return 0.0
    distances = [
        haversine_m(point["lng"], point["lat"], candidate["lng"], candidate["lat"])
        for candidate in candidates
        if candidate.get("lng") is not None and candidate.get("lat") is not None
    ]
    return safe_round(min(distances), 2) if distances else 0.0


def _road_proximity_factor(points: List[Dict[str, Any]], options: Dict[str, Any]) -> Dict[str, Any]:
    road_segments = _normalize_line_segments(options.get("road_features") or options.get("roads") or [])
    if not points or not road_segments:
        return _empty_road_proximity_factor()
    road_midpoints = [{"lng": item["lng"], "lat": item["lat"], "value": item.get("length_km") or 1.0} for item in road_segments]
    distances = [_nearest_distance(point, road_midpoints) for point in points]
    valid = [distance for distance in distances if distance > 0]
    if not valid:
        return _empty_road_proximity_factor()
    return {
        "nearest_road_distance_m": safe_round(min(valid), 2),
        "mean_nearest_road_distance_m": safe_round(sum(valid) / len(valid), 2),
        "within_100m_share": safe_round(len([distance for distance in valid if distance <= 100.0]) / len(valid), 6),
        "road_feature_count": len(road_segments),
    }


def _site_proximity_factor(site_points: List[Dict[str, Any]], center: List[float], options: Dict[str, Any]) -> Dict[str, Any]:
    if not site_points:
        return _empty_proximity_factor()
    site = site_points[0]
    radius_m = float(options.get("poi_mix_radius_m") or options.get("radius_m") or 500.0)
    hotspot_points = _normalize_points(options.get("hotspots") or options.get("hotspot_points") or [])
    nearby_pois = _normalize_points(options.get("nearby_pois") or [])
    competitor_points = _normalize_points(options.get("competitor_points") or options.get("competitors") or [])
    road_segments = _normalize_line_segments(options.get("road_features") or options.get("roads") or [])
    road_midpoints = [{"lng": item["lng"], "lat": item["lat"], "value": item.get("length_km") or 1.0} for item in road_segments]
    nearby = [
        poi
        for poi in nearby_pois
        if haversine_m(site["lng"], site["lat"], poi["lng"], poi["lat"]) <= radius_m
    ]
    competitors = [
        poi
        for poi in competitor_points
        if haversine_m(site["lng"], site["lat"], poi["lng"], poi["lat"]) <= radius_m
    ]
    return {
        "center_distance_m": safe_round(haversine_m(center[0], center[1], site["lng"], site["lat"]), 2) if len(center) >= 2 else 0.0,
        "nearest_hotspot_distance_m": _nearest_distance(site, hotspot_points),
        "nearest_road_distance_m": _nearest_distance(site, road_midpoints),
        "nearby_poi_count": len(nearby),
        "nearby_category_count": len({poi.get("category") for poi in nearby if poi.get("category")}),
        "nearby_competitor_count": len(competitors),
        "poi_mix_radius_m": safe_round(radius_m, 2),
    }


def _base_factor_payload(mode: str, center: List[float], count: int) -> Dict[str, Any]:
    return {
        "spatial_factor_version": SPATIAL_FACTOR_VERSION,
        "geometry_mode": mode,
        "center": center,
        "count": int(count),
        "point_count": int(count),
        "centroid": [],
        "centroid_factor": {"centroid": [], "direction_from_center": "", "distance_from_center_m": 0.0},
        "direction_factor": _direction_factor([], center),
        "ring_factor": _ring_factor([], center),
        "hotspot_factor": _hotspot_factor([], center),
        "proximity_factor": _empty_proximity_factor(),
        "road_proximity_factor": _empty_road_proximity_factor(),
        "orientation_factor": _orientation_factor([]),
        "consistency_factor": {"alignment_level": "unknown", "reason": "缺少可比对的空间因子"},
    }


def build_spatial_factors(
    items: Iterable[Any],
    mode: str,
    center: Optional[List[float]] = None,
    subject_key: Optional[str] = None,
    value_key: Optional[str] = None,
    options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    safe_mode = str(mode or "point").strip().lower()
    options = dict(options or {})
    grid_size = int(options.get("grid_size") or 4)

    if safe_mode == "line":
        segments = _normalize_line_segments(items)
        resolved_center = _resolve_center(segments, center)
        payload = _base_factor_payload("line", resolved_center, len(segments))
        payload.update(
            {
                "centroid": _centroid(segments),
                "centroid_factor": _centroid_factor(segments, resolved_center),
                "direction_factor": _direction_factor(segments, resolved_center),
                "ring_factor": _ring_factor(segments, resolved_center),
                "hotspot_factor": _hotspot_factor(segments, resolved_center, grid_size=grid_size),
                "orientation_factor": _orientation_factor(segments),
                "road_proximity_factor": _road_proximity_factor(segments, options),
            }
        )
        return payload

    if safe_mode in {"grid", "weighted_grid"}:
        points = _normalize_grid(items, subject_key=subject_key, value_key=value_key)
        resolved_center = _resolve_center(points, center)
        payload = _base_factor_payload("grid", resolved_center, len(points))
        payload.update(
            {
                "centroid": _centroid(points),
                "centroid_factor": _centroid_factor(points, resolved_center),
                "direction_factor": _direction_factor(points, resolved_center),
                "ring_factor": _ring_factor(points, resolved_center),
                "hotspot_factor": _hotspot_factor(points, resolved_center, grid_size=grid_size),
                "road_proximity_factor": _road_proximity_factor(points, options),
            }
        )
        return payload

    if safe_mode == "polygon":
        points = _normalize_polygons(items)
        resolved_center = _resolve_center(points, center)
        payload = _base_factor_payload("polygon", resolved_center, len(points))
        payload.update(
            {
                "centroid": _centroid(points),
                "centroid_factor": _centroid_factor(points, resolved_center),
                "direction_factor": _direction_factor(points, resolved_center),
                "ring_factor": _ring_factor(points, resolved_center),
                "hotspot_factor": _hotspot_factor(points, resolved_center, grid_size=grid_size),
                "polygon_factor": {
                    "polygon_count": len(points),
                    "total_area_score": safe_round(sum(float(item.get("area_score") or 0.0) for item in points), 8),
                },
            }
        )
        return payload

    if safe_mode == "site":
        points = _normalize_points(items, subject_key=subject_key, value_key=value_key)
        resolved_center = _resolve_center(points, center)
        payload = _base_factor_payload("site", resolved_center, len(points))
        payload.update(
            {
                "centroid": _centroid(points),
                "centroid_factor": _centroid_factor(points, resolved_center),
                "direction_factor": _direction_factor(points, resolved_center),
                "ring_factor": _ring_factor(points, resolved_center),
                "hotspot_factor": _hotspot_factor(points, resolved_center, grid_size=grid_size),
                "proximity_factor": _site_proximity_factor(points, resolved_center, options),
                "road_proximity_factor": _road_proximity_factor(points, options),
            }
        )
        return payload

    points = _normalize_points(items, subject_key=subject_key, value_key=value_key)
    resolved_center = _resolve_center(points, center)
    payload = _base_factor_payload("point", resolved_center, len(points))
    payload.update(
        {
            "centroid": _centroid(points),
            "centroid_factor": _centroid_factor(points, resolved_center),
            "direction_factor": _direction_factor(points, resolved_center),
            "ring_factor": _ring_factor(points, resolved_center),
            "hotspot_factor": _hotspot_factor(points, resolved_center, grid_size=grid_size),
            "road_proximity_factor": _road_proximity_factor(points, options),
        }
    )
    return payload


def _direction_key_from_label(label: str) -> str:
    for key, value in _DIRECTIONS:
        if value == label:
            return key
    return ""


def _adjacent_direction(a: str, b: str) -> bool:
    if a not in _DIRECTION_INDEX or b not in _DIRECTION_INDEX:
        return False
    distance = abs(_DIRECTION_INDEX[a] - _DIRECTION_INDEX[b])
    return min(distance, 8 - distance) == 1


def build_spatial_consistency_factor(primary_factors: Dict[str, Any], reference_factors: Dict[str, Any]) -> Dict[str, Any]:
    primary_direction = (primary_factors.get("direction_factor") or {}).get("dominant_direction_key") or _direction_key_from_label(
        str((primary_factors.get("direction_factor") or {}).get("dominant_direction") or "")
    )
    primary_secondary = (primary_factors.get("direction_factor") or {}).get("secondary_direction_key") or _direction_key_from_label(
        str((primary_factors.get("direction_factor") or {}).get("secondary_direction") or "")
    )
    reference_orientation = (reference_factors.get("orientation_factor") or {}).get("dominant_orientation_key")
    reference_secondary_orientation = (reference_factors.get("orientation_factor") or {}).get("secondary_orientation_key")
    reference_direction = (reference_factors.get("direction_factor") or {}).get("dominant_direction_key") or _direction_key_from_label(
        str((reference_factors.get("direction_factor") or {}).get("dominant_direction") or "")
    )

    if not primary_direction:
        return {"alignment_level": "unknown", "reason": "主对象缺少主导方位", "matched_evidence": []}

    matched: List[str] = []
    partial: List[str] = []
    if reference_orientation:
        if primary_direction in _ORIENTATION_DIRECTION_KEYS.get(reference_orientation, set()):
            matched.append("primary_direction_matches_reference_orientation")
        elif reference_secondary_orientation and primary_direction in _ORIENTATION_DIRECTION_KEYS.get(reference_secondary_orientation, set()):
            matched.append("primary_direction_matches_secondary_orientation")
        elif primary_secondary in _ORIENTATION_DIRECTION_KEYS.get(reference_orientation, set()):
            partial.append("secondary_direction_matches_reference_orientation")
    elif reference_direction:
        if primary_direction == reference_direction:
            matched.append("primary_direction_matches_reference_direction")
        elif _adjacent_direction(primary_direction, reference_direction) or primary_secondary == reference_direction:
            partial.append("direction_is_adjacent_or_secondary")
    else:
        return {"alignment_level": "unknown", "reason": "参照对象缺少可比对的方位或轴向", "matched_evidence": []}

    if matched:
        level = "high"
        reason = "主对象高值方向与参照空间骨架高度一致"
    elif partial:
        level = "partial"
        reason = "主对象高值方向与参照空间骨架部分一致"
    else:
        level = "low"
        reason = "主对象高值方向与参照空间骨架一致性较弱"
    return {
        "alignment_level": level,
        "reason": reason,
        "primary_direction": _direction_label(primary_direction),
        "primary_secondary_direction": _direction_label(primary_secondary),
        "reference_orientation": _ORIENTATION_LABELS.get(reference_orientation, ""),
        "reference_secondary_orientation": _ORIENTATION_LABELS.get(reference_secondary_orientation, ""),
        "reference_direction": _direction_label(reference_direction),
        "matched_evidence": matched or partial,
    }


def _shift_factor(first_points: List[Dict[str, Any]], last_points: List[Dict[str, Any]]) -> Dict[str, Any]:
    first_centroid = _centroid(first_points)
    last_centroid = _centroid(last_points)
    if len(first_centroid) < 2 or len(last_centroid) < 2:
        return {"from_centroid": first_centroid, "to_centroid": last_centroid, "direction": "", "distance_m": 0.0}
    direction_key = _direction_key_for_point(last_centroid[0], last_centroid[1], first_centroid)
    return {
        "from_centroid": first_centroid,
        "to_centroid": last_centroid,
        "direction": _direction_label(direction_key),
        "distance_m": safe_round(haversine_m(first_centroid[0], first_centroid[1], last_centroid[0], last_centroid[1]), 2),
    }


def build_subcategory_spatial_trends(
    year_summaries: Iterable[Dict[str, Any]],
    center: Optional[List[float]] = None,
    top_n: int = 6,
) -> Dict[str, Any]:
    summaries = sorted(
        [item for item in year_summaries or [] if isinstance(item, dict)],
        key=lambda item: float(item.get("year") or 0),
    )
    all_points = _normalize_points(point for summary in summaries for point in (summary.get("points") or []))
    resolved_center = _resolve_center(all_points, center)
    overall = build_spatial_factors(all_points, mode="point", center=resolved_center)
    if len(summaries) < 2:
        return {"spatial_factors": overall, "subcategory_spatial_trend_rows": [], "subcategory_spatial_summary": []}

    first, last = summaries[0], summaries[-1]
    first_counts = dict(first.get("subcategory_counts") or {})
    last_counts = dict(last.get("subcategory_counts") or {})
    names = sorted(set(first_counts) | set(last_counts))
    parent_by_name: Dict[str, str] = {}
    for summary in summaries:
        for row in summary.get("top_subcategories") or []:
            if isinstance(row, dict) and row.get("name") and not parent_by_name.get(str(row.get("name"))):
                parent_by_name[str(row.get("name"))] = _as_text(row.get("parent"))

    ranked = sorted(
        [
            {
                "name": name,
                "parent": parent_by_name.get(name, ""),
                "start_count": int(first_counts.get(name) or 0),
                "end_count": int(last_counts.get(name) or 0),
                "delta": int(last_counts.get(name) or 0) - int(first_counts.get(name) or 0),
            }
            for name in names
        ],
        key=lambda item: (abs(int(item["delta"])), int(item["end_count"])),
        reverse=True,
    )[: max(1, int(top_n or 6))]

    first_points_by_subcategory: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    last_points_by_subcategory: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for point in _normalize_points(first.get("points") or []):
        first_points_by_subcategory[point["subcategory"]].append(point)
    for point in _normalize_points(last.get("points") or []):
        last_points_by_subcategory[point["subcategory"]].append(point)

    rows: List[Dict[str, Any]] = []
    for item in ranked:
        name = item["name"]
        first_points = first_points_by_subcategory.get(name, [])
        last_points = last_points_by_subcategory.get(name, [])
        if int(item.get("delta") or 0) == 0 or (not first_points and not last_points):
            continue
        factors = build_spatial_factors(last_points, mode="point", center=resolved_center)
        before_hotspots = build_spatial_factors(first_points, mode="point", center=resolved_center).get("hotspot_factor") or {}
        hotspot = factors.get("hotspot_factor") or {}
        direction = factors.get("direction_factor") or {}
        ring = factors.get("ring_factor") or {}
        shift = _shift_factor(first_points, last_points)
        area_counts = Counter(point.get("area") or "未知区域" for point in last_points)
        top_area = area_counts.most_common(1)[0][0] if area_counts else ""
        rows.append(
            {
                **item,
                "dominant_direction": direction.get("dominant_direction") or "",
                "secondary_direction": direction.get("secondary_direction") or "",
                "dominant_ring": ring.get("dominant_ring") or "",
                "dominant_ring_share": ring.get("dominant_share") or 0.0,
                "centroid_shift_direction": shift.get("direction") or "",
                "centroid_shift_m": shift.get("distance_m") or 0.0,
                "hotspot_grid_count": hotspot.get("hotspot_grid_count") or 0,
                "hotspot_grid_count_delta": int(hotspot.get("hotspot_grid_count") or 0) - int(before_hotspots.get("hotspot_grid_count") or 0),
                "hotspot_pattern": hotspot.get("hotspot_pattern") or "none",
                "dominant_hotspot_direction": hotspot.get("dominant_hotspot_direction") or "",
                "top_area": top_area,
            }
        )

    summary = []
    for row in rows[:3]:
        direction = row.get("dominant_direction") or "方向不明显"
        ring = row.get("dominant_ring") or "圈层不明显"
        delta = int(row.get("delta") or 0)
        summary.append(
            f"{row.get('name')}较首年{'增加' if delta >= 0 else '减少'}{abs(delta)}个，末年主要位于{direction}方向、{ring}。"
        )
    return {
        "spatial_factors": overall,
        "subcategory_spatial_trend_rows": rows,
        "subcategory_spatial_summary": summary,
    }


def build_subcategory_spatial_snapshot(
    points: Iterable[Dict[str, Any]],
    center: Optional[List[float]] = None,
    top_n: int = 6,
) -> Dict[str, Any]:
    normalized_points = _normalize_points(points or [])
    resolved_center = _resolve_center(normalized_points, center)
    if not normalized_points:
        return {"subcategory_spatial_rows": [], "subcategory_spatial_summary": []}

    total = max(1, len(normalized_points))
    subcategory_counts = Counter(point.get("subcategory") or "未分类小类" for point in normalized_points)
    subcategory_parent: Dict[str, str] = {}
    points_by_subcategory: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for point in normalized_points:
        name = point.get("subcategory") or "未分类小类"
        subcategory_parent.setdefault(name, point.get("category") or "未分类")
        points_by_subcategory[name].append(point)

    rows: List[Dict[str, Any]] = []
    for name, count in sorted(subcategory_counts.items(), key=lambda item: (-int(item[1]), _as_text(item[0])))[: max(1, int(top_n or 6))]:
        subcategory_points = points_by_subcategory.get(name, [])
        factors = build_spatial_factors(subcategory_points, mode="point", center=resolved_center)
        direction = factors.get("direction_factor") or {}
        ring = factors.get("ring_factor") or {}
        hotspot = factors.get("hotspot_factor") or {}
        centroid = factors.get("centroid_factor") or {}
        area_counts = Counter(point.get("area") or "未知区域" for point in subcategory_points)
        top_area = area_counts.most_common(1)[0][0] if area_counts else ""
        rows.append(
            {
                "name": name,
                "parent": subcategory_parent.get(name) or "未分类",
                "count": int(count),
                "share": safe_round(int(count) / total, 6),
                "dominant_direction": direction.get("dominant_direction") or "",
                "dominant_ring": ring.get("dominant_ring") or "",
                "hotspot_pattern": hotspot.get("hotspot_pattern") or "none",
                "hotspot_grid_count": hotspot.get("hotspot_grid_count") or 0,
                "top_area": top_area,
                "centroid_factor": centroid,
            }
        )

    summary = []
    for row in rows[:3]:
        parts = [f"小类{row.get('name')}占比{safe_round(float(row.get('share') or 0.0) * 100, 2)}%"]
        if row.get("dominant_direction"):
            parts.append(f"主要集中在{row['dominant_direction']}方向")
        if row.get("dominant_ring"):
            parts.append(str(row["dominant_ring"]))
        if row.get("top_area"):
            parts.append(f"高频区域为{row['top_area']}")
        summary.append("、".join(parts) + "。")
    return {"subcategory_spatial_rows": rows, "subcategory_spatial_summary": summary}
