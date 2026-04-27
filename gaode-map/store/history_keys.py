from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List


def coerce_json_value(value: Any) -> Any:
    if value is None or isinstance(value, (dict, list, int, float, bool)):
        return value
    text = str(value).strip()
    if not text or text.lower() == "null":
        return None
    try:
        return json.loads(text)
    except Exception:
        return value


def normalize_history_polygon(polygon: Any) -> List[Any]:
    payload = coerce_json_value(polygon)
    if not isinstance(payload, list) or not payload:
        return []
    if isinstance(payload[0], list) and payload[0] and isinstance(payload[0][0], list):
        return payload
    return [payload]


def _normalize_scalar(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    return str(value).strip()


def _normalize_coords(value: Any) -> Any:
    payload = coerce_json_value(value)
    if isinstance(payload, list):
        return [_normalize_coords(item) for item in payload]
    if isinstance(payload, tuple):
        return [_normalize_coords(item) for item in payload]
    if isinstance(payload, (int, float)):
        return round(float(payload), 6)
    return payload


def build_history_record_id(params: Dict[str, Any] | None, polygon: Any) -> str:
    params = params if isinstance(params, dict) else {}
    polygon_payload = normalize_history_polygon(polygon)
    if not polygon_payload:
        drawn_polygon = params.get("drawn_polygon")
        polygon_payload = normalize_history_polygon(drawn_polygon)
    basis = {
        "polygon": _normalize_coords(polygon_payload),
        "time_min": _normalize_scalar(params.get("time_min")),
        "mode": _normalize_scalar(params.get("mode")).lower(),
        "source": _normalize_scalar(params.get("source")).lower(),
        "keywords": _normalize_scalar(params.get("keywords")),
    }
    encoded = json.dumps(basis, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha1(encoded.encode("utf-8")).hexdigest()[:24]
