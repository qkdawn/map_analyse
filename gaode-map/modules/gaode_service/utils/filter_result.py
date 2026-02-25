"""
过滤高德 POI 结果：使用网格编码 + 距离阈值去重，主要针对中文名称。
"""

from __future__ import annotations

import json
from math import asin, ceil, cos, floor, radians, sin, sqrt
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

EARTH_RADIUS_M = 6_371_000.0
DEFAULT_GRID_SIZE_M = 500.0
DEFAULT_DISTANCE_THRESHOLD_M = 800.0
TYPE_MAP_PATH = Path(__file__).resolve().parents[3] / "share" / "type_map.json"
_TYPE_CLASS_MAP: Dict[str, str] = {}


def filter_result(
    pois: Iterable[Dict],
    ref_point: Optional[Tuple[float, float]] = None,
    grid_size_m: float = DEFAULT_GRID_SIZE_M,
    distance_threshold_m: float = DEFAULT_DISTANCE_THRESHOLD_M,
) -> List[Dict]:
    """
    对同一 typecode 的 POI 进行近距离去重，仅处理中文名称：
    - 使用网格编码（默认 grid_size_m 边长）快速定位近邻，再用 haversine 二次校验。
    - 同网格/距离内，中文名全字相同或前三个中文字符相同视为重复，保留优先级：评分高 > 距离中心近 > 原始顺序靠前。
    - 输入/输出与高德返回的 POI 结构一致，仅移除重复项；type_map 未覆盖的 typecode 也会被过滤掉。
    """
    pois_list = list(pois)
    if not pois_list:
        return []

    pois_list = _filter_unknown_typecode(pois_list)
    if not pois_list:
        return []

    grid_size_deg = grid_size_m / 111_000.0
    candidates = _build_candidates(pois_list, ref_point, grid_size_deg, grid_size_m)
    # 优先级从高到低排序（评分高、距离近、序号前）。
    candidates.sort(key=lambda item: item["priority"])

    kept_meta: Dict[str, Dict[Tuple[int, int], List[Dict]]] = {}
    kept_indices: List[int] = []

    for item in candidates:
        coords = item["coords"]
        if coords is None:
            kept_indices.append(item["index"])
            continue

        typecode = item["typecode"]
        grid_bucket = kept_meta.setdefault(typecode, {})
        cell_x, cell_y = item["cell"]

        # 检查周围 3x3 网格的已保留条目，是否存在中文名重复且距离过近。
        if _has_close_duplicate(
            item,
            grid_bucket,
            distance_threshold_m=distance_threshold_m,
        ):
            continue

        kept_indices.append(item["index"])
        grid_bucket.setdefault((cell_x, cell_y), []).append(item)

    # 保持原始顺序输出。
    kept_indices_set = set(kept_indices)
    return [poi for idx, poi in enumerate(pois_list) if idx in kept_indices_set]


def _build_candidates(
    pois: List[Dict],
    ref_point: Optional[Tuple[float, float]],
    grid_size_deg: float,
    grid_size_m: float,
) -> List[Dict]:
    candidates: List[Dict] = []
    for idx, poi in enumerate(pois):
        lng_lat = _parse_location(poi.get("location"))
        prefix = _first_n_chinese_chars(poi.get("name", ""), 3)
        cell = _grid_cell(lng_lat, grid_size_deg) if lng_lat else None
        priority = _priority(poi, idx, ref_point, lng_lat)
        raw_type = (poi.get("typecode") or "").strip()
        typecode = _TYPE_CLASS_MAP.get(raw_type, raw_type)
        candidates.append(
            {
                "poi": poi,
                "index": idx,
                "coords": lng_lat,
                "cell": cell,
                "prefix": prefix,
                "grid_size_m": grid_size_m,
                "name": (poi.get("name") or "").strip(),
                "typecode": typecode,
                "priority": priority,
            }
        )
    return candidates


def _priority(
    poi: Dict,
    index: int,
    ref_point: Optional[Tuple[float, float]],
    coords: Optional[Tuple[float, float]],
) -> Tuple[float, float, int]:
    """
    排序优先级：评分高、距离中心近、原始顺序靠前。
    返回 tuple 便于排序，越小优先级越高。
    """
    rating = _safe_float(
        poi.get("rating")
        or (poi.get("biz_ext") or {}).get("rating")
        or (poi.get("biz_ext") or {}).get("rating_res")
    )
    rating_score = -(rating or 0.0)

    distance_field = _safe_float(poi.get("distance"))
    if distance_field is not None:
        distance_score = distance_field
    elif ref_point and coords:
        distance_score = _haversine_m(coords, ref_point)
    else:
        distance_score = float("inf")

    return (rating_score, distance_score, index)


def _has_close_duplicate(
    item: Dict,
    grid_bucket: Dict[Tuple[int, int], List[Dict]],
    distance_threshold_m: float,
) -> bool:
    cell_x, cell_y = item["cell"]
    prefix = item["prefix"]

    # 仅中文名参与去重，缺少中文名则直接保留。
    if not prefix:
        return False

    radius = max(1, int(ceil(distance_threshold_m / item["grid_size_m"])))

    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            neighbors = grid_bucket.get((cell_x + dx, cell_y + dy), [])
            for other in neighbors:
                if not other["prefix"]:
                    continue
                if not _is_name_duplicate(item["name"], other["name"], prefix, other["prefix"]):
                    continue
                dist = _haversine_m(item["coords"], other["coords"])
                if dist <= distance_threshold_m:
                    return True
    return False


def _grid_cell(
    lng_lat: Optional[Tuple[float, float]], grid_size_deg: float
) -> Optional[Tuple[int, int]]:
    if not lng_lat:
        return None
    lng, lat = lng_lat
    return (floor(lng / grid_size_deg), floor(lat / grid_size_deg))


def _parse_location(location: Optional[str]) -> Optional[Tuple[float, float]]:
    """
    高德 location 为 "lng,lat"。
    """
    if not location or not isinstance(location, str):
        return None
    parts = location.split(",")
    if len(parts) < 2:
        return None
    try:
        lng = float(parts[0])
        lat = float(parts[1])
    except (TypeError, ValueError):
        return None
    return (lng, lat)


def _haversine_m(
    lng_lat_a: Optional[Tuple[float, float]],
    lng_lat_b: Optional[Tuple[float, float]],
) -> float:
    """
    计算两点球面距离（米）。
    """
    if not lng_lat_a or not lng_lat_b:
        return float("inf")
    lng1, lat1 = lng_lat_a
    lng2, lat2 = lng_lat_b

    lng1, lat1, lng2, lat2 = map(radians, (lng1, lat1, lng2, lat2))
    dlng = lng2 - lng1
    dlat = lat2 - lat1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def _first_chinese_char(text: str) -> str:
    for ch in text.strip():
        if _is_chinese(ch):
            return ch
    return ""


def _first_n_chinese_chars(text: str, n: int) -> str:
    chars = []
    for ch in text.strip():
        if _is_chinese(ch):
            chars.append(ch)
            if len(chars) >= n:
                break
    return "".join(chars)


def _is_chinese(ch: str) -> bool:
    return "\u4e00" <= ch <= "\u9fff"


def _is_name_duplicate(
    name_a: str,
    name_b: str,
    prefix_a: str,
    prefix_b: str,
) -> bool:
    if not (prefix_a and prefix_b):
        return False
    if name_a and name_b and name_a == name_b:
        return True
    return prefix_a == prefix_b


def _safe_float(value) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _load_type_class_map(path: Path = TYPE_MAP_PATH) -> Dict[str, str]:
    """
    将 type_map.json 中的 types 映射到统一类别（point_type/id），
    用于不同 typecode 间的同类去重。
    """
    if not path.exists():
        return {}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}

    mapping: Dict[str, str] = {}
    for group in data.get("groups", []):
        for item in group.get("items", []):
            type_class = item.get("point_type") or item.get("id") or ""
            if not type_class:
                continue
            for typecode in (item.get("types") or "").split("|"):
                typecode = typecode.strip()
                if typecode:
                    mapping[typecode] = type_class
    return mapping


# 模块加载时构建一次映射，失败时保持空映射回退原始 typecode。
_TYPE_CLASS_MAP = _load_type_class_map()
_SUPPORTED_TYPECODES = set(_TYPE_CLASS_MAP.keys())


def _filter_unknown_typecode(pois: List[Dict]) -> List[Dict]:
    """
    移除不在 type_map 中的 POI，保持未知配置时的回退行为。
    """
    if not _SUPPORTED_TYPECODES:
        return pois

    filtered: List[Dict] = []
    for poi in pois:
        typecode = (poi.get("typecode") or "").strip()
        if typecode and typecode in _SUPPORTED_TYPECODES:
            filtered.append(poi)
    return filtered
