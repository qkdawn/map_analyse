"""
Helpers for merging paged Gaode POI responses.
"""

from typing import Dict, Iterable, List, Optional

from .get_type_info import map_typecode_to_point_type


def merge_poi(responses: Iterable[Dict]) -> List[Dict]:
    """
    Flatten and deduplicate POI records from multiple page responses.
    """
    merged: List[Dict] = []
    seen = set()
    for resp in responses:
        for poi in resp.get("pois", []) or []:
            key = poi.get("id") or f"{poi.get('name')}|{poi.get('location')}"
            if key in seen:
                continue
            seen.add(key)
            merged.append(poi)
    return merged


def poi_to_point(
    poi: Dict,
    fallback_type: str = "poi",
    include_lines: bool = True,
) -> Dict:
    """
    Convert a Gaode POI dict to the map schema point structure.
    """
    location = poi.get("location", "0,0")
    lng_str, lat_str = (location.split(",") + ["0", "0"])[:2]
    point_type = map_typecode_to_point_type(poi.get("typecode", ""), fallback_type)

    point = {
        "lng": float(lng_str),
        "lat": float(lat_str),
        "name": poi.get("name", ""),
        "type": point_type,
        "distance": _safe_int(poi.get("distance")),
    }

    if include_lines and poi.get("address"):
        lines = [part for part in poi["address"].split(";") if part]
        if lines:
            point["lines"] = lines

    return point


def _safe_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None
