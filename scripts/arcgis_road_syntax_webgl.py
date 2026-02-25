#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import io
import json
import math
import os
import time

_now = getattr(time, "perf_counter", time.time)


def _is_finite_number(value):
    try:
        if hasattr(math, "isfinite"):
            return bool(math.isfinite(value))
        return not (math.isinf(value) or math.isnan(value))
    except Exception:
        return False


def _safe_float(value):
    try:
        if value is None:
            return None
        f = float(value)
        if not _is_finite_number(f):
            return None
        return f
    except Exception:
        return None


def _mix_hex(a, b, t):
    t = max(0.0, min(1.0, float(t)))
    ah = str(a or "#000000").lstrip("#")
    bh = str(b or "#000000").lstrip("#")
    if len(ah) != 6 or len(bh) != 6:
        return "#000000"
    ar, ag, ab = int(ah[0:2], 16), int(ah[2:4], 16), int(ah[4:6], 16)
    br, bg, bb = int(bh[0:2], 16), int(bh[2:4], 16), int(bh[4:6], 16)
    rr = int(round(ar + (br - ar) * t))
    rg = int(round(ag + (bg - ag) * t))
    rb = int(round(ab + (bb - ab) * t))
    return "#{:02x}{:02x}{:02x}".format(rr, rg, rb)


def _color_from_norm(norm):
    n = max(0.0, min(1.0, float(norm)))
    if n <= 0.5:
        return _mix_hex("#1d4ed8", "#16a34a", n / 0.5)
    return _mix_hex("#16a34a", "#f59e0b", (n - 0.5) / 0.5)


def _quantile(sorted_values, q):
    if not sorted_values:
        return None
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    p = max(0.0, min(1.0, float(q))) * (len(sorted_values) - 1)
    lo = int(math.floor(p))
    hi = int(math.ceil(p))
    if lo == hi:
        return float(sorted_values[lo])
    lv = float(sorted_values[lo])
    hv = float(sorted_values[hi])
    return lv + (hv - lv) * (p - lo)


def _normalize_line_coords(coords):
    if not isinstance(coords, list) or not coords:
        return []
    out = []

    def append_point(raw):
        if not isinstance(raw, (list, tuple)) or len(raw) < 2:
            return
        lng = _safe_float(raw[0])
        lat = _safe_float(raw[1])
        if lng is None or lat is None:
            return
        if out and out[-1][0] == lng and out[-1][1] == lat:
            return
        out.append([round(lng, 6), round(lat, 6)])

    first = coords[0]
    if isinstance(first, (list, tuple)) and len(first) >= 2 and _safe_float(first[0]) is not None:
        for pt in coords:
            append_point(pt)
    else:
        for segment in coords:
            if not isinstance(segment, list):
                continue
            for pt in segment:
                append_point(pt)
    if len(out) < 2:
        return []
    return out


def _resolve_metric_candidates(metric_field):
    primary = str(metric_field or "").strip() or "accessibility_score"
    if primary == "accessibility_score":
        return [primary, "integration_score"]
    if primary == "integration_score":
        return [primary, "accessibility_score"]
    if primary == "connectivity_score":
        return [primary, "degree_score"]
    if primary == "degree_score":
        return [primary, "connectivity_score"]
    return [primary]


def _pick_metric(props, metric_field):
    fields = _resolve_metric_candidates(metric_field)
    for field in fields:
        v = _safe_float(props.get(field))
        if v is not None:
            return float(v)
    return None


def build_webgl_roads(payload):
    metric_field = str(payload.get("metric_field") or "accessibility_score").strip() or "accessibility_score"
    target_coord_type = str(payload.get("target_coord_type") or "gcj02").strip().lower()
    if target_coord_type not in {"gcj02", "wgs84"}:
        target_coord_type = "gcj02"

    raw_features = payload.get("roads_features")
    feature_list = raw_features if isinstance(raw_features, list) else []
    metric_values = []
    missing_metric_count = 0
    normalized_features = []

    for feature in feature_list:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        geometry_type = str(geometry.get("type") or "")
        if geometry_type not in {"LineString", "MultiLineString"}:
            continue
        line_coords = _normalize_line_coords(geometry.get("coordinates"))
        if len(line_coords) < 2:
            continue
        props = feature.get("properties") if isinstance(feature.get("properties"), dict) else {}
        metric_value = _pick_metric(props, metric_field)
        if metric_value is None:
            missing_metric_count += 1
        else:
            metric_values.append(float(metric_value))
        normalized_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": line_coords},
                "properties": dict(props),
                "_metric": metric_value,
            }
        )

    sorted_values = sorted(metric_values)
    p10 = _quantile(sorted_values, 0.10)
    p90 = _quantile(sorted_values, 0.90)
    min_v = sorted_values[0] if sorted_values else 0.0
    max_v = sorted_values[-1] if sorted_values else 0.0
    if p10 is None:
        p10 = min_v
    if p90 is None:
        p90 = max_v
    if p90 <= p10:
        p10, p90 = min_v, max_v

    span = max(1e-9, p90 - p10) if p90 > p10 else max(1e-9, max_v - min_v)
    for feature in normalized_features:
        raw_metric = feature.pop("_metric", None)
        metric_value = _safe_float(raw_metric)
        if metric_value is None:
            norm = None
        else:
            norm = (metric_value - p10) / span
            norm = max(0.0, min(1.0, norm))
        props = feature["properties"]
        props["webgl_metric_field"] = metric_field
        if metric_value is None:
            props["webgl_metric_value"] = None
            props["webgl_metric_norm"] = None
            props["webgl_metric_missing"] = True
            props["webgl_color"] = "#7f7f7f"
            props["webgl_width"] = 1.2
            props["webgl_opacity"] = 0.25
        else:
            props["webgl_metric_value"] = round(metric_value, 8)
            props["webgl_metric_norm"] = round(norm, 8)
            props["webgl_metric_missing"] = False
            props["webgl_color"] = _color_from_norm(norm)
            props["webgl_width"] = round(1.2 + 3.2 * norm, 2)
            props["webgl_opacity"] = round(0.45 + 0.45 * norm, 3)

    return {
        "ok": True,
        "status": "ok",
        "metric_field": metric_field,
        "coord_type": target_coord_type,
        "roads": {
            "type": "FeatureCollection",
            "features": normalized_features,
            "count": len(normalized_features),
        },
        "stats": {
            "input_features": len(feature_list),
            "output_features": len(normalized_features),
            "metric_min": round(min_v, 8),
            "metric_max": round(max_v, 8),
            "metric_p10": round(float(p10), 8) if p10 is not None else 0.0,
            "metric_p90": round(float(p90), 8) if p90 is not None else 0.0,
            "missing_metric_count": int(missing_metric_count),
        },
    }


def main():
    parser = argparse.ArgumentParser(description="ArcGIS road syntax WebGL preprocessor")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    started = _now()
    try:
        with io.open(args.input, "r", encoding="utf-8") as f:
            payload = json.load(f)
        if not isinstance(payload, dict):
            raise RuntimeError("input payload must be object")

        result = build_webgl_roads(payload)
        result["elapsed_ms"] = round((_now() - started) * 1000.0, 2)

        output_dir = os.path.dirname(os.path.abspath(args.output))
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        content = json.dumps(result, ensure_ascii=True)
        if not isinstance(content, bytes):
            content = content.encode("utf-8")
        with open(args.output, "wb") as f:
            f.write(content)
        return 0
    except Exception as exc:
        result = {
            "ok": False,
            "status": "error",
            "error": str(exc),
            "roads": {"type": "FeatureCollection", "features": [], "count": 0},
            "elapsed_ms": round((_now() - started) * 1000.0, 2),
        }
        content = json.dumps(result, ensure_ascii=True)
        if not isinstance(content, bytes):
            content = content.encode("utf-8")
        with open(args.output, "wb") as f:
            f.write(content)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
