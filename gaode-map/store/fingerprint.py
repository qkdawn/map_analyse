"""
中心点指纹生成工具。
"""

from __future__ import annotations

import json
from typing import Dict, Optional, Tuple


def _center_fingerprint(
    center: Dict,
    search_type: str,
    place_types: Optional[Tuple[str, ...]] = None,
    source: Optional[str] = None,
    year: Optional[int] = None,
) -> str:
    """
    生成中心点的规范化字符串，用于匹配（包含 place_types）。
    """
    try:
        center = center or {}
        normalized_place_types = tuple(sorted({item for item in (place_types or ()) if item}))
        fingerprint_payload = {
            "lng": center.get("lng"),
            "lat": center.get("lat"),
            "type": (search_type or "").strip(),
            "place_types": normalized_place_types,
            "source": (source or "").strip(),
            "year": year,
        }
        return json.dumps(fingerprint_payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        return ""


def build_center_fingerprint(
    center: Dict,
    search_type: str,
    place_types: Optional[Tuple[str, ...]] = None,
    source: Optional[str] = None,
    year: Optional[int] = None,
) -> str:
    """
    构建中心点指纹 JSON 字符串。
    """
    return _center_fingerprint(center, search_type, place_types, source, year)
