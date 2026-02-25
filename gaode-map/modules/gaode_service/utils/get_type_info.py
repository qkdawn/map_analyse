"""
Type mapping utilities for Gaode POI requests.

统一读取 share/type_map.json（含分组、颜色、types/keywords/point_type）。
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple, cast


_TYPE_MAP_PATH = Path(__file__).resolve().parents[3] / "share" / "type_map.json"

# 读取统一配置，并展平所有 item 便于查询。
_TYPE_CONFIG: Dict = cast(
    Dict,
    json.loads(_TYPE_MAP_PATH.read_text(encoding="utf-8")),
)
_ALL_ITEMS = [
    item
    for group in _TYPE_CONFIG.get("groups", [])
    for item in group.get("items", [])
]
_LABEL_TO_INFO: Dict[str, Dict[str, str]] = {
    item["label"]: item for item in _ALL_ITEMS if item.get("label")
}
_ID_TO_INFO: Dict[str, Dict[str, str]] = {
    item["id"]: item for item in _ALL_ITEMS if item.get("id")
}


def _build_typecode_to_point_type(items: List[Dict[str, str]]) -> Dict[str, str]:
    """
    由统一配置动态生成 typecode -> point_type 映射，避免手工同步。
    """
    mapping: Dict[str, str] = {}
    for info in items:
        types = info.get("types", "")
        point_type = info.get("point_type", "")
        if not types or not point_type:
            continue
        for typecode in types.split("|"):
            code = typecode.strip()
            if code:
                mapping[code] = point_type
    return mapping


_TYPECODE_TO_POINT_TYPE: Dict[str, str] = _build_typecode_to_point_type(_ALL_ITEMS)

# Fallback when the provided category is unknown.
_DEFAULT_TYPE = {"types": "", "keywords": "", "point_type": "poi"}


def list_place_types() -> List[str]:
    """
    返回配置中的所有类型名称列表（按配置顺序）。
    """
    return [item["label"] for item in _ALL_ITEMS if item.get("label")]


def get_type_info(place_type: str) -> Tuple[str, str, str]:
    """
    Map user input to Gaode search parameters.

    Returns:
        (types, keywords, point_type)
    """
    normalized = place_type.strip() if place_type else ""
    info = _LABEL_TO_INFO.get(normalized) or _ID_TO_INFO.get(normalized)
    if info:
        return info.get("types", ""), info.get("keywords", ""), info.get("point_type", "")
    if normalized:
        # Fallback: still use the user text as keyword to avoid empty queries.
        return "", normalized, "poi"
    return _DEFAULT_TYPE["types"], _DEFAULT_TYPE["keywords"], _DEFAULT_TYPE["point_type"]


def map_typecode_to_point_type(typecode: str, fallback: str = "poi") -> str:
    """
    Convert Gaode typecode to the simplified map point type.
    优先使用调用方提供的 point_type，保证与前端过滤 id 对齐。
    """
    if not typecode:
        return fallback
    if fallback and fallback != "poi":
        return fallback
    return _TYPECODE_TO_POINT_TYPE.get(typecode, fallback)
