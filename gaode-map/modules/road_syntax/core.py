import csv
import bisect
import logging
import math
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import requests
from shapely.geometry import LineString, Polygon
from shapely.prepared import prep

from core.config import settings
from modules.gaode_service.utils.transform_posi import gcj02_to_wgs84, wgs84_to_gcj02
from modules.road_syntax.arcgis_bridge import ArcGISRoadSyntaxBridgeError, run_arcgis_road_syntax_webgl


OverpassMode = Literal["walking", "bicycling", "driving"]
logger = logging.getLogger(__name__)

MODE_HIGHWAY_REGEX: Dict[OverpassMode, str] = {
    "walking": (
        "footway|path|pedestrian|living_street|residential|unclassified|service|track|steps|"
        "cycleway|tertiary|secondary|primary"
    ),
    "bicycling": (
        "cycleway|path|living_street|residential|unclassified|service|track|"
        "tertiary|secondary|primary"
    ),
    "driving": (
        "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service"
    ),
}


def _safe_round(value: float, digits: int = 6) -> float:
    if not math.isfinite(float(value)):
        return 0.0
    return round(float(value), digits)


def _ensure_closed_ring(coords: List[List[float]]) -> List[List[float]]:
    if not coords:
        return []
    if coords[0] == coords[-1]:
        return coords
    return coords + [coords[0]]


def _coords_to_wgs84_polygon(
    polygon: List[List[float]],
    coord_type: Literal["gcj02", "wgs84"],
) -> Polygon:
    ring: List[List[float]] = []
    for pt in polygon or []:
        if not isinstance(pt, (list, tuple)) or len(pt) < 2:
            continue
        try:
            lng = float(pt[0])
            lat = float(pt[1])
        except (TypeError, ValueError):
            continue
        if coord_type == "gcj02":
            lng, lat = gcj02_to_wgs84(lng, lat)
        ring.append([lng, lat])

    ring = _ensure_closed_ring(ring)
    if len(ring) < 4:
        return Polygon()

    poly = Polygon(ring)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if isinstance(poly, Polygon):
        return poly
    if hasattr(poly, "geoms"):
        geoms = [g for g in poly.geoms if isinstance(g, Polygon)]
        if geoms:
            return max(geoms, key=lambda g: g.area)
    return Polygon()


def _haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(1e-12, 1.0 - a)))
    return r * c


def _build_overpass_query(
    bbox: Tuple[float, float, float, float],
    mode: OverpassMode,
) -> str:
    south, west, north, east = bbox
    regex = MODE_HIGHWAY_REGEX.get(mode, MODE_HIGHWAY_REGEX["walking"])
    return f"""
[out:json][timeout:25];
(
  way["highway"~"{regex}"]({south:.7f},{west:.7f},{north:.7f},{east:.7f});
);
out body geom;
"""


def _resolve_overpass_endpoint() -> str:
    endpoint = str(getattr(settings, "overpass_endpoint", "") or "").strip()
    if not endpoint:
        raise RuntimeError("OVERPASS_ENDPOINT 未配置，请设置本地 Overpass 地址。")
    return endpoint


def _fetch_overpass_elements(query: str) -> List[Dict[str, Any]]:
    endpoint = _resolve_overpass_endpoint()
    try:
        response = requests.post(
            endpoint,
            data={"data": query},
            timeout=(8, 45),
        )
        if response.status_code != 200:
            preview = (response.text or "").strip().replace("\n", " ")[:280]
            raise RuntimeError(f"HTTP {response.status_code}, body={preview}")
        raw = (response.text or "").strip()
        if not raw:
            raise RuntimeError("empty response body")
        if raw[:1] != "{":
            preview = raw.replace("\n", " ")[:320]
            if "runtime error" in raw.lower() or "timed out" in raw.lower():
                raise RuntimeError(f"Overpass query timeout/error: {preview}")
            raise RuntimeError(f"non-JSON response: {preview}")
        payload = response.json()
        return payload.get("elements") or []
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Local Overpass request failed ({endpoint}): {exc}") from exc


def _to_output_coord(
    lon: float,
    lat: float,
    output_coord_type: Literal["gcj02", "wgs84"],
) -> Tuple[float, float]:
    if output_coord_type == "gcj02":
        return wgs84_to_gcj02(lon, lat)
    return lon, lat


def _normalize_label(radius_m: int) -> str:
    return f"r{int(radius_m)}"


def _radius_label_from_header(header: str) -> str:
    match = re.search(r"\bR(\d+(?:\.\d+)?)\b", header or "", flags=re.IGNORECASE)
    if not match:
        return "global"
    value = float(match.group(1))
    if value.is_integer():
        return f"r{int(value)}"
    return "r" + str(value).replace(".", "_")


def _build_radius_arg(radii_m: List[int]) -> str:
    cleaned = sorted({int(r) for r in radii_m if int(r) > 0})
    if not cleaned:
        cleaned = [800, 2000]
    return ",".join([str(v) for v in cleaned] + ["n"])


def _resolve_depthmap_cli_path(override_path: Optional[str] = None) -> str:
    candidates: List[str] = []
    if override_path:
        candidates.append(str(override_path).strip())
    if getattr(settings, "depthmapx_cli_path", ""):
        candidates.append(str(settings.depthmapx_cli_path).strip())
    candidates.extend(["depthmapXcli", "depthmapXcli.exe"])

    dedup: List[str] = []
    seen = set()
    for item in candidates:
        if not item or item in seen:
            continue
        seen.add(item)
        dedup.append(item)

    for item in dedup:
        p = Path(item)
        if p.exists():
            return str(p)
        resolved = shutil.which(item)
        if resolved:
            return resolved

    raise RuntimeError(
        "depthmapXcli 未找到。请安装 depthmapXcli 并配置 DEPTHMAPX_CLI_PATH。"
    )


def _run_depthmap_cmd(
    cli_path: str,
    args: List[str],
    workdir: Path,
    timeout_s: int,
) -> None:
    command = [cli_path] + args
    try:
        proc = subprocess.run(
            command,
            cwd=str(workdir),
            capture_output=True,
            text=True,
            timeout=max(30, int(timeout_s)),
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"depthmapXcli 超时（>{timeout_s}s）：{' '.join(command)}") from exc
    except OSError as exc:
        raise RuntimeError(f"执行 depthmapXcli 失败：{exc}") from exc

    if proc.returncode != 0:
        stderr_tail = (proc.stderr or "").strip().splitlines()[-8:]
        stdout_tail = (proc.stdout or "").strip().splitlines()[-8:]
        tail = "\n".join((stderr_tail or stdout_tail)[:8])
        raise RuntimeError(
            f"depthmapXcli 命令失败（exit={proc.returncode}）：{' '.join(command)}\n{tail}"
        )


def _select_metric_columns(fieldnames: List[str], metric_key: str) -> Dict[str, str]:
    chosen: Dict[str, str] = {}
    best_len: Dict[str, int] = {}
    for name in fieldnames:
        lower = (name or "").strip().lower()
        if metric_key not in lower:
            continue
        # Exclude weighted variants and other non-base derivatives.
        if "wgt" in lower or "route weight" in lower or "[slw]" in lower:
            continue
        label = _radius_label_from_header(name)
        length = len(name)
        prev = best_len.get(label)
        if prev is None or length < prev:
            chosen[label] = name
            best_len[label] = length
    return chosen


def _extract_finite_column_values(rows: List[Dict[str, Any]], column_name: str) -> List[float]:
    values: List[float] = []
    if not column_name:
        return values
    for row in rows:
        try:
            value = float(row.get(column_name, ""))
        except (TypeError, ValueError):
            continue
        if math.isfinite(value):
            values.append(value)
    return values


def _column_numeric_stats(rows: List[Dict[str, Any]], column_name: str) -> Tuple[int, float, int]:
    values = _extract_finite_column_values(rows, column_name)
    if not values:
        return 0, 0.0, 0
    spread = float(max(values) - min(values))
    distinct_count = len({round(v, 10) for v in values})
    return len(values), spread, distinct_count


def _select_single_metric_column(
    fieldnames: List[str],
    include_patterns: List[Tuple[str, ...]],
    rows: Optional[List[Dict[str, Any]]] = None,
    preferred_tokens: Optional[Tuple[str, ...]] = None,
) -> Optional[str]:
    excluded_tokens = (
        "wgt",
        "route weight",
        "[slw]",
        "segment id",
        "axial line id",
        "line id",
        "point id",
        "entity id",
        "p-value",
        "pvalue",
        "zscore",
        "z-score",
        "quantile",
        "percentile",
        "rank",
    )
    best_name: Optional[str] = None
    best_rank: Optional[Tuple[int, int, int, float, int, int, int, int]] = None
    for name in fieldnames:
        lower = (name or "").strip().lower()
        if not lower:
            continue
        if any(token in lower for token in excluded_tokens):
            continue
        matched_rank: Optional[int] = None
        for idx, pattern in enumerate(include_patterns):
            if pattern and all((token or "").lower() in lower for token in pattern):
                matched_rank = idx
                break
        if matched_rank is None:
            continue
        valid_count = 0
        spread = 0.0
        distinct_count = 0
        if rows is not None and rows:
            valid_count, spread, distinct_count = _column_numeric_stats(rows, name)
        preferred_hit = 0
        if preferred_tokens:
            preferred_hit = 1 if any((token or "").lower() in lower for token in preferred_tokens) else 0
        # Higher tuple is better:
        # 1) has numeric values, 2) valid sample count, 3) has variance,
        # 4) variance magnitude, 5) distinct values, 6) explicit preferred token hit,
        # 7) include pattern priority (earlier pattern is better via negative index),
        # 8) shorter header name as tie-breaker.
        rank = (
            1 if valid_count > 0 else 0,
            valid_count,
            1 if spread > 1e-12 else 0,
            spread,
            distinct_count,
            preferred_hit,
            -matched_rank,
            -len(name),
        )
        if best_rank is None or rank > best_rank:
            best_rank = rank
            best_name = name
    return best_name


def _metric_bounds(values_by_label: Dict[str, List[float]]) -> Dict[str, Tuple[float, float]]:
    bounds: Dict[str, Tuple[float, float]] = {}
    for label, values in values_by_label.items():
        finite = [float(v) for v in values if math.isfinite(float(v))]
        if not finite:
            continue
        bounds[label] = (min(finite), max(finite))
    return bounds


def _norm(value: Optional[float], bounds: Optional[Tuple[float, float]]) -> float:
    if value is None or bounds is None:
        return 0.0
    lo, hi = bounds
    if hi <= lo:
        return 0.0
    return max(0.0, min(1.0, (float(value) - lo) / (hi - lo)))


def _pearson_corr(xs: List[float], ys: List[float]) -> float:
    if len(xs) != len(ys) or len(xs) < 2:
        return 0.0
    n = float(len(xs))
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    cov = 0.0
    var_x = 0.0
    var_y = 0.0
    for x, y in zip(xs, ys):
        dx = float(x) - mean_x
        dy = float(y) - mean_y
        cov += dx * dy
        var_x += dx * dx
        var_y += dy * dy
    if var_x <= 0.0 or var_y <= 0.0:
        return 0.0
    return cov / math.sqrt(var_x * var_y)


def _linear_regression(xs: List[float], ys: List[float]) -> Tuple[float, float]:
    if len(xs) != len(ys) or len(xs) < 2:
        return 0.0, 0.0
    n = float(len(xs))
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    var_x = 0.0
    cov_xy = 0.0
    for x, y in zip(xs, ys):
        dx = float(x) - mean_x
        dy = float(y) - mean_y
        var_x += dx * dx
        cov_xy += dx * dy
    if var_x <= 0.0:
        return 0.0, mean_y
    slope = cov_xy / var_x
    intercept = mean_y - slope * mean_x
    return float(slope), float(intercept)


def _percentile_rank(sorted_values: List[float], value: float) -> float:
    if not sorted_values:
        return 0.0
    v = float(value)
    idx = bisect.bisect_right(sorted_values, v)
    return max(0.0, min(1.0, idx / float(len(sorted_values))))


def _quantile_value(sorted_values: List[float], q: float) -> float:
    if not sorted_values:
        return 0.0
    qq = max(0.0, min(1.0, float(q)))
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    pos = qq * (len(sorted_values) - 1)
    lo = int(math.floor(pos))
    hi = min(len(sorted_values) - 1, lo + 1)
    t = pos - lo
    return float(sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * t)


def _sample_scatter_points(
    points: List[Tuple[float, float]],
    max_points: int = 3000,
    bins: int = 20,
) -> List[Tuple[float, float]]:
    if len(points) <= max_points:
        return list(points)
    if max_points <= 0:
        return []

    clean = [
        (float(x), float(y))
        for x, y in points
        if math.isfinite(float(x)) and math.isfinite(float(y))
    ]
    if len(clean) <= max_points:
        return clean
    if not clean:
        return []
    # Quantile-stratified sampling by x (connectivity):
    # 1) split by x rank into fixed bins;
    # 2) allocate quota by bin share;
    # 3) deterministic, evenly spaced picks after sorting by y.
    clean.sort(key=lambda p: (p[0], p[1]))
    bucket_count = max(1, int(bins))
    buckets: List[List[Tuple[float, float]]] = [[] for _ in range(bucket_count)]
    total_len = len(clean)
    for idx, point in enumerate(clean):
        bid = int((idx * bucket_count) / float(total_len))
        bid = max(0, min(bucket_count - 1, bid))
        buckets[bid].append(point)

    total_n = float(len(clean))
    quotas: List[int] = [0 for _ in range(bucket_count)]
    frac_parts: List[Tuple[float, int]] = []
    used = 0
    for i, bucket in enumerate(buckets):
        if not bucket:
            continue
        exact = (len(bucket) / total_n) * max_points
        base = int(math.floor(exact))
        base = max(1, min(base, len(bucket)))
        quotas[i] = base
        used += base
        frac_parts.append((exact - math.floor(exact), i))

    if used > max_points:
        over = used - max_points
        reducible = sorted(
            [(quotas[i], i) for i in range(bucket_count) if quotas[i] > 1],
            reverse=True,
        )
        idx = 0
        while over > 0 and reducible:
            _, bid = reducible[idx % len(reducible)]
            if quotas[bid] > 1:
                quotas[bid] -= 1
                over -= 1
            idx += 1
            reducible = [(quotas[i], i) for _, i in reducible if quotas[i] > 1]
        used = sum(quotas)

    if used < max_points:
        remain = max_points - used
        for _, bid in sorted(frac_parts, reverse=True):
            if remain <= 0:
                break
            cap = len(buckets[bid]) - quotas[bid]
            if cap <= 0:
                continue
            take = min(cap, remain)
            quotas[bid] += take
            remain -= take

    sampled: List[Tuple[float, float]] = []
    for i, bucket in enumerate(buckets):
        quota = quotas[i]
        if quota <= 0 or not bucket:
            continue
        ordered = sorted(bucket, key=lambda p: (p[1], p[0]))
        if quota >= len(ordered):
            sampled.extend(ordered)
            continue
        if quota == 1:
            sampled.append(ordered[len(ordered) // 2])
            continue
        step = (len(ordered) - 1) / float(quota - 1)
        for j in range(quota):
            idx = int(round(j * step))
            idx = max(0, min(len(ordered) - 1, idx))
            sampled.append(ordered[idx])

    if len(sampled) > max_points:
        sampled = sampled[:max_points]
    return sampled


def _is_finite_number(value: Any) -> bool:
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _coord_key(point: List[float], digits: int = 6) -> Tuple[float, float]:
    return (_safe_round(float(point[0]), digits), _safe_round(float(point[1]), digits))


def _vector_from_to(a: List[float], b: List[float]) -> Tuple[float, float]:
    return (float(b[0]) - float(a[0]), float(b[1]) - float(a[1]))


def _cosine_similarity(v1: Tuple[float, float], v2: Tuple[float, float]) -> float:
    n1 = math.hypot(v1[0], v1[1])
    n2 = math.hypot(v2[0], v2[1])
    if n1 <= 1e-12 or n2 <= 1e-12:
        return -1.0
    return max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2)))


def _line_length_by_coords(coords: List[List[float]]) -> float:
    if len(coords) < 2:
        return 0.0
    total = 0.0
    for a, b in zip(coords, coords[1:]):
        total += _haversine_m(float(a[0]), float(a[1]), float(b[0]), float(b[1]))
    return max(0.0, total)


def _merge_feature_properties(features: List[Dict[str, Any]], lengths_m: List[float]) -> Dict[str, Any]:
    if not features:
        return {}
    props_list = [((f.get("properties") or {}) if isinstance(f, dict) else {}) for f in features]
    keys = set()
    for p in props_list:
        keys.update(p.keys())

    out: Dict[str, Any] = {}
    total_w = sum(max(0.0, float(w)) for w in lengths_m)
    if total_w <= 1e-9:
        total_w = float(len(features))
        weights = [1.0 for _ in features]
    else:
        weights = [max(0.0, float(w)) for w in lengths_m]

    for key in keys:
        values = [p.get(key) for p in props_list]
        non_none = [v for v in values if v is not None]
        if not non_none:
            continue

        if all(isinstance(v, bool) for v in non_none):
            out[key] = any(bool(v) for v in non_none)
            continue

        if all(_is_finite_number(v) for v in non_none):
            acc = 0.0
            w_sum = 0.0
            for v, w in zip(values, weights):
                if not _is_finite_number(v):
                    continue
                ww = max(0.0, float(w))
                acc += float(v) * ww
                w_sum += ww
            if w_sum <= 1e-9:
                out[key] = 0.0
            elif key == "length_m":
                out[key] = _safe_round(acc / w_sum, 2)
            else:
                out[key] = _safe_round(acc / w_sum, 8)
            continue

        out[key] = non_none[0]

    out["length_m"] = _safe_round(sum(max(0.0, float(v)) for v in lengths_m), 2)
    return out


def _merge_linestring_features(
    features: List[Dict[str, Any]],
    bucket_step: float = 0.025,
    angle_cos_min: float = 0.92,
) -> List[Dict[str, Any]]:
    if len(features) < 2:
        return list(features)

    step = max(0.005, min(0.2, float(bucket_step)))
    segments: List[Dict[str, Any]] = []
    node_map: Dict[Tuple[float, float], List[int]] = {}
    passthrough: List[Dict[str, Any]] = []

    for feature in features:
        geometry = (feature or {}).get("geometry") or {}
        if geometry.get("type") != "LineString":
            passthrough.append(feature)
            continue
        coords_raw = geometry.get("coordinates") or []
        coords: List[List[float]] = []
        for pt in coords_raw:
            if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                continue
            try:
                coords.append([float(pt[0]), float(pt[1])])
            except (TypeError, ValueError):
                continue
        if len(coords) < 2:
            passthrough.append(feature)
            continue

        props = ((feature or {}).get("properties") or {})
        start_key = _coord_key(coords[0], 6)
        end_key = _coord_key(coords[-1], 6)
        if start_key == end_key:
            passthrough.append(feature)
            continue
        acc_score = float(props.get("accessibility_score", props.get("integration_score", 0.0)) or 0.0)
        bucket = int(round(max(0.0, min(1.0, acc_score)) / step))
        flags = (
            bool(props.get("is_skeleton_choice_top20", False)),
            bool(props.get("is_skeleton_integration_top20", False)),
        )
        length_m = float(props.get("length_m", 0.0) or 0.0)
        if length_m <= 0:
            length_m = _line_length_by_coords(coords)
        seg_id = len(segments)
        seg = {
            "id": seg_id,
            "feature": feature,
            "coords": coords,
            "start_key": start_key,
            "end_key": end_key,
            "bucket": bucket,
            "flags": flags,
            "length_m": max(0.0, length_m),
        }
        segments.append(seg)
        node_map.setdefault(start_key, []).append(seg_id)
        node_map.setdefault(end_key, []).append(seg_id)

    if len(segments) < 2:
        return list(features)

    visited: set[int] = set()
    merged_out: List[Dict[str, Any]] = []

    for seg in segments:
        sid = int(seg["id"])
        if sid in visited:
            continue
        visited.add(sid)
        chain_ids: List[int] = [sid]
        chain_bucket = int(seg["bucket"])
        chain_flags = seg["flags"]
        path: List[List[float]] = [list(pt) for pt in seg["coords"]]

        def _extend_side(at_start: bool) -> bool:
            nonlocal path
            if len(path) < 2:
                return False
            current_pt = path[0] if at_start else path[-1]
            current_key = _coord_key(current_pt, 6)
            if len(node_map.get(current_key, [])) != 2:
                return False
            candidates = [cid for cid in node_map.get(current_key, []) if cid not in visited]
            if len(candidates) != 1:
                return False
            next_id = int(candidates[0])
            next_seg = segments[next_id]
            if int(next_seg["bucket"]) != chain_bucket:
                return False
            if next_seg["flags"] != chain_flags:
                return False

            oriented = next_seg["coords"] if next_seg["start_key"] == current_key else list(reversed(next_seg["coords"]))
            if len(oriented) < 2:
                return False
            other_pt = oriented[-1]
            if at_start:
                inner_pt = path[1]
                v_in = _vector_from_to(current_pt, inner_pt)
                v_next = (float(current_pt[0]) - float(other_pt[0]), float(current_pt[1]) - float(other_pt[1]))
            else:
                inner_pt = path[-2]
                v_in = _vector_from_to(inner_pt, current_pt)
                v_next = _vector_from_to(current_pt, other_pt)
            if _cosine_similarity(v_in, v_next) < angle_cos_min:
                return False

            if at_start:
                prepend = list(reversed(oriented))
                path = prepend[:-1] + path
            else:
                path = path + oriented[1:]
            visited.add(next_id)
            chain_ids.append(next_id)
            return True

        while True:
            changed = False
            if _extend_side(True):
                changed = True
            if _extend_side(False):
                changed = True
            if not changed:
                break

        chain_features = [segments[cid]["feature"] for cid in chain_ids]
        chain_lengths = [float(segments[cid]["length_m"]) for cid in chain_ids]
        merged_props = _merge_feature_properties(chain_features, chain_lengths)
        merged_feature = {
            "type": "Feature",
            "properties": merged_props,
            "geometry": {
                "type": "LineString",
                "coordinates": [[_safe_round(pt[0], 6), _safe_round(pt[1], 6)] for pt in path],
            },
        }
        merged_out.append(merged_feature)

    if not merged_out:
        return list(features)
    return merged_out + passthrough


def _empty_result(
    mode: OverpassMode,
    coord_type: Literal["gcj02", "wgs84"],
    radii_m: Optional[List[int]] = None,
    metric: str = "choice",
) -> Dict[str, Any]:
    local_labels = [_normalize_label(r) for r in sorted({int(v) for v in (radii_m or []) if int(v) > 0})]
    default_radius_label = local_labels[0] if local_labels else "global"
    return {
        "summary": {
            "node_count": 0,
            "edge_count": 0,
            "rendered_edge_count": 0,
            "edge_merge_ratio": 1.0,
            "network_length_km": 0.0,
            "avg_degree": 0.0,
            "avg_closeness": 0.0,
            "avg_choice": 0.0,
            "avg_accessibility_global": 0.0,
            "avg_connectivity": 0.0,
            "avg_control": 0.0,
            "avg_depth": 0.0,
            "control_source_column": "",
            "control_valid_count": 0,
            "depth_source_column": "",
            "depth_valid_count": 0,
            "avg_intelligibility": 0.0,
            "avg_intelligibility_r2": 0.0,
            "avg_integration_global": 0.0,
            "avg_choice_global": 0.0,
            "avg_integration_local": 0.0,
            "avg_choice_local": 0.0,
            "avg_integration_by_radius": {label: 0.0 for label in local_labels},
            "avg_choice_by_radius": {label: 0.0 for label in local_labels},
            "radius_labels": local_labels,
            "mode": mode,
            "coord_type": coord_type,
            "default_metric": metric,
            "default_radius_label": default_radius_label,
            "analysis_engine": "depthmapxcli",
        },
        "top_nodes": [],
        "roads": {"type": "FeatureCollection", "features": [], "count": 0},
        "nodes": {"type": "FeatureCollection", "features": [], "count": 0},
        "diagnostics": {
            "intelligibility_scatter": [],
            "regression": {"slope": 0.0, "intercept": 0.0, "r": 0.0, "r2": 0.0, "n": 0},
        },
        "webgl": {
            "enabled": False,
            "backend": "none",
            "status": "disabled",
            "metric_field": "",
            "coord_type": coord_type,
            "roads": {"type": "FeatureCollection", "features": [], "count": 0},
            "elapsed_ms": 0.0,
        },
    }


def analyze_road_syntax(
    polygon: List[List[float]],
    coord_type: Literal["gcj02", "wgs84"] = "gcj02",
    mode: OverpassMode = "walking",
    include_geojson: bool = True,
    max_edge_features: Optional[int] = None,
    radii_m: Optional[List[int]] = None,
    metric: Literal["choice", "integration"] = "choice",
    depthmap_cli_path: Optional[str] = None,
    merge_geojson_edges: bool = True,
    merge_bucket_step: float = 0.025,
    use_arcgis_webgl: bool = False,
    arcgis_python_path: Optional[str] = None,
    arcgis_timeout_sec: int = 300,
    arcgis_metric_field: Optional[str] = None,
) -> Dict[str, Any]:
    local_radii = sorted({int(r) for r in (radii_m or [800, 2000]) if int(r) > 0})[:5]
    local_labels = [_normalize_label(r) for r in local_radii]
    render_metric = "integration" if metric == "integration" else "choice"
    default_radius_label = local_labels[0] if local_labels else "global"

    wgs_poly = _coords_to_wgs84_polygon(polygon, coord_type=coord_type)
    if wgs_poly.is_empty:
        return _empty_result(mode, coord_type="gcj02", radii_m=local_radii, metric=render_metric)

    minx, miny, maxx, maxy = wgs_poly.bounds
    query = _build_overpass_query((miny, minx, maxy, maxx), mode=mode)
    elements = _fetch_overpass_elements(query)

    node_coords: Dict[int, Tuple[float, float]] = {}
    ways: List[Dict[str, Any]] = []
    for elem in elements:
        elem_type = elem.get("type")
        if elem_type == "node":
            try:
                node_id = int(elem.get("id"))
                lon = float(elem.get("lon"))
                lat = float(elem.get("lat"))
                node_coords[node_id] = (lon, lat)
            except (TypeError, ValueError):
                continue
        elif elem_type == "way":
            if not elem.get("tags", {}).get("highway"):
                continue
            nids = elem.get("nodes") or []
            geom = elem.get("geometry") or []
            if len(nids) < 2 and len(geom) < 2:
                continue
            ways.append(elem)

    if not ways:
        return _empty_result(mode, coord_type="gcj02", radii_m=local_radii, metric=render_metric)

    prepared = prep(wgs_poly)
    edge_inputs: List[Dict[str, Any]] = []
    seen_edges = set()
    def _edge_key_by_coord(lon1: float, lat1: float, lon2: float, lat2: float) -> Tuple[Tuple[float, float], Tuple[float, float]]:
        a = (_safe_round(lon1, 7), _safe_round(lat1, 7))
        b = (_safe_round(lon2, 7), _safe_round(lat2, 7))
        return (a, b) if a <= b else (b, a)

    for way in ways:
        tags = way.get("tags") or {}
        highway = str(tags.get("highway") or "")
        nids = way.get("nodes") or []
        used_node_segments = False
        if nids and node_coords:
            for u_raw, v_raw in zip(nids, nids[1:]):
                try:
                    u = int(u_raw)
                    v = int(v_raw)
                except (TypeError, ValueError):
                    continue
                if u == v or u not in node_coords or v not in node_coords:
                    continue
                used_node_segments = True
                lon1, lat1 = node_coords[u]
                lon2, lat2 = node_coords[v]
                line = LineString([(lon1, lat1), (lon2, lat2)])
                if line.is_empty or not prepared.intersects(line):
                    continue

                edge_key = _edge_key_by_coord(lon1, lat1, lon2, lat2)
                if edge_key in seen_edges:
                    continue
                seen_edges.add(edge_key)

                length_m = _haversine_m(lon1, lat1, lon2, lat2)
                if length_m <= 0:
                    continue

                edge_inputs.append(
                    {
                        "ref": len(edge_inputs) + 1,
                        "x1": lon1,
                        "y1": lat1,
                        "x2": lon2,
                        "y2": lat2,
                        "highway": highway,
                        "length_m": length_m,
                    }
                )

        if used_node_segments:
            continue

        geom = way.get("geometry") or []
        coords: List[Tuple[float, float]] = []
        for pt in geom:
            if not isinstance(pt, dict):
                continue
            try:
                lon = float(pt.get("lon"))
                lat = float(pt.get("lat"))
            except (TypeError, ValueError):
                continue
            coords.append((lon, lat))
        if len(coords) < 2:
            continue
        for (lon1, lat1), (lon2, lat2) in zip(coords, coords[1:]):
            if lon1 == lon2 and lat1 == lat2:
                continue
            line = LineString([(lon1, lat1), (lon2, lat2)])
            if line.is_empty or not prepared.intersects(line):
                continue
            edge_key = _edge_key_by_coord(lon1, lat1, lon2, lat2)
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)
            length_m = _haversine_m(lon1, lat1, lon2, lat2)
            if length_m <= 0:
                continue
            edge_inputs.append(
                {
                    "ref": len(edge_inputs) + 1,
                    "x1": lon1,
                    "y1": lat1,
                    "x2": lon2,
                    "y2": lat2,
                    "highway": highway,
                    "length_m": length_m,
                }
            )

    if not edge_inputs:
        return _empty_result(mode, coord_type="gcj02", radii_m=local_radii, metric=render_metric)

    cli_path = _resolve_depthmap_cli_path(depthmap_cli_path)
    timeout_s = int(getattr(settings, "depthmapx_timeout_s", 300) or 300)
    tulip_bins = int(getattr(settings, "depthmapx_tulip_bins", 1024) or 1024)

    with tempfile.TemporaryDirectory(prefix="road_syntax_depthmapx_") as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        lines_csv = tmpdir / "input_lines.csv"
        graph_imported = tmpdir / "01_import.graph"
        graph_segment = tmpdir / "02_segment.graph"
        graph_analysed = tmpdir / "03_segment_analysed.graph"
        result_csv = tmpdir / "04_shapegraph_map.csv"

        with lines_csv.open("w", newline="", encoding="utf-8") as f:
            # depthmapXcli IMPORT is sensitive to CRLF in large CSV inputs.
            # Force LF line endings to avoid "No lines found in drawing".
            writer = csv.writer(f, lineterminator="\n")
            writer.writerow(["Ref", "x1", "y1", "x2", "y2"])
            for e in edge_inputs:
                writer.writerow([e["ref"], e["x1"], e["y1"], e["x2"], e["y2"]])

        _run_depthmap_cmd(
            cli_path,
            ["-m", "IMPORT", "-f", str(lines_csv), "-o", str(graph_imported), "-it", "drawing"],
            tmpdir,
            timeout_s,
        )
        _run_depthmap_cmd(
            cli_path,
            [
                "-m",
                "MAPCONVERT",
                "-f",
                str(graph_imported),
                "-o",
                str(graph_segment),
                "-co",
                "segment",
                "-con",
                "road_segments",
            ],
            tmpdir,
            timeout_s,
        )
        _run_depthmap_cmd(
            cli_path,
            [
                "-m",
                "SEGMENT",
                "-f",
                str(graph_segment),
                "-o",
                str(graph_analysed),
                "-st",
                "tulip",
                "-srt",
                "metric",
                "-stb",
                str(max(4, min(1024, tulip_bins))),
                "-sic",
                "-sr",
                _build_radius_arg(local_radii),
            ],
            tmpdir,
            timeout_s,
        )
        _run_depthmap_cmd(
            cli_path,
            ["-m", "EXPORT", "-f", str(graph_analysed), "-o", str(result_csv), "-em", "shapegraph-map-csv"],
            tmpdir,
            timeout_s,
        )

        with result_csv.open("r", newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            fieldnames = list(reader.fieldnames or [])
            rows = list(reader)

    if not rows:
        return _empty_result(mode, coord_type="gcj02", radii_m=local_radii, metric=render_metric)

    choice_columns = _select_metric_columns(fieldnames, "choice")
    integration_columns = _select_metric_columns(fieldnames, "integration")
    connectivity_columns = _select_metric_columns(fieldnames, "connectivity")
    control_col = _select_single_metric_column(
        fieldnames,
        include_patterns=[
            ("controllability",),
            ("control",),
        ],
        rows=rows,
        preferred_tokens=("controllability", "control"),
    )
    depth_col = _select_single_metric_column(
        fieldnames,
        include_patterns=[
            ("mean", "depth"),
            ("meandepth",),
            ("depth",),
        ],
        rows=rows,
        preferred_tokens=("mean depth", "meandepth", "depth"),
    )
    connectivity_col = _select_single_metric_column(
        fieldnames,
        include_patterns=[
            ("connectivity",),
        ],
        rows=rows,
        preferred_tokens=("connectivity",),
    )

    # Keep only requested local radii and global metric columns.
    allow_labels = set(local_labels)
    allow_labels.add("global")
    choice_columns = {k: v for k, v in choice_columns.items() if k in allow_labels}
    integration_columns = {k: v for k, v in integration_columns.items() if k in allow_labels}
    connectivity_columns = {k: v for k, v in connectivity_columns.items() if k in allow_labels}
    if not connectivity_col:
        connectivity_col = connectivity_columns.get("global")
    if not connectivity_col and connectivity_columns:
        connectivity_col = sorted(connectivity_columns.values(), key=len)[0]
    if connectivity_col:
        conn_valid_count, conn_spread, conn_distinct = _column_numeric_stats(rows, connectivity_col)
        logger.info(
            "[road-syntax] connectivity column selected=%s valid=%d spread=%.6g distinct=%d",
            connectivity_col,
            conn_valid_count,
            conn_spread,
            conn_distinct,
        )
    if not control_col:
        logger.warning("[road-syntax] control column not found in depthmap output headers")
    else:
        control_valid_count_dbg, control_spread_dbg, control_distinct_dbg = _column_numeric_stats(rows, control_col)
        logger.info(
            "[road-syntax] control column selected=%s valid=%d spread=%.6g distinct=%d",
            control_col,
            control_valid_count_dbg,
            control_spread_dbg,
            control_distinct_dbg,
        )
    if not depth_col:
        logger.warning("[road-syntax] depth column not found in depthmap output headers")
    else:
        depth_valid_count_dbg, depth_spread_dbg, depth_distinct_dbg = _column_numeric_stats(rows, depth_col)
        logger.info(
            "[road-syntax] depth column selected=%s valid=%d spread=%.6g distinct=%d",
            depth_col,
            depth_valid_count_dbg,
            depth_spread_dbg,
            depth_distinct_dbg,
        )
    default_choice_has_local = default_radius_label != "global" and default_radius_label in choice_columns
    default_integration_has_local = default_radius_label != "global" and default_radius_label in integration_columns

    prepared_poly = prep(wgs_poly)
    metric_values_choice: Dict[str, List[float]] = {k: [] for k in choice_columns}
    metric_values_integ: Dict[str, List[float]] = {k: [] for k in integration_columns}
    metric_values_conn_raw: List[float] = []
    metric_values_control_raw: List[float] = []
    metric_values_depth_raw: List[float] = []

    parsed_edges: List[Dict[str, Any]] = []
    neighbor_sets: Dict[Tuple[float, float], set] = {}
    total_length_m = 0.0

    for row in rows:
        try:
            x1 = float(row.get("x1", ""))
            y1 = float(row.get("y1", ""))
            x2 = float(row.get("x2", ""))
            y2 = float(row.get("y2", ""))
        except (TypeError, ValueError):
            continue

        line = LineString([(x1, y1), (x2, y2)])
        if line.is_empty or not prepared_poly.intersects(line):
            continue

        raw_choice: Dict[str, Optional[float]] = {}
        raw_integration: Dict[str, Optional[float]] = {}
        raw_connectivity: Optional[float] = None
        raw_control: Optional[float] = None
        raw_depth: Optional[float] = None

        for label, col in choice_columns.items():
            try:
                val = float(row.get(col, ""))
            except (TypeError, ValueError):
                val = None
            raw_choice[label] = val
            if val is not None and math.isfinite(val):
                metric_values_choice[label].append(val)

        for label, col in integration_columns.items():
            try:
                val = float(row.get(col, ""))
            except (TypeError, ValueError):
                val = None
            raw_integration[label] = val
            if val is not None and math.isfinite(val):
                metric_values_integ[label].append(val)

        if connectivity_col:
            try:
                conn_val = float(row.get(connectivity_col, ""))
            except (TypeError, ValueError):
                conn_val = None
            if conn_val is not None and math.isfinite(conn_val):
                raw_connectivity = conn_val
                metric_values_conn_raw.append(conn_val)

        if control_col:
            try:
                control_val = float(row.get(control_col, ""))
            except (TypeError, ValueError):
                control_val = None
            if control_val is not None and math.isfinite(control_val):
                raw_control = control_val
                metric_values_control_raw.append(control_val)

        if depth_col:
            try:
                depth_val = float(row.get(depth_col, ""))
            except (TypeError, ValueError):
                depth_val = None
            if depth_val is not None and math.isfinite(depth_val):
                raw_depth = depth_val
                metric_values_depth_raw.append(depth_val)

        key1 = (_safe_round(x1, 7), _safe_round(y1, 7))
        key2 = (_safe_round(x2, 7), _safe_round(y2, 7))
        if key1 != key2:
            neighbor_sets.setdefault(key1, set()).add(key2)
            neighbor_sets.setdefault(key2, set()).add(key1)

        length_m = _haversine_m(x1, y1, x2, y2)
        total_length_m += max(0.0, length_m)

        parsed_edges.append(
            {
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "key1": key1,
                "key2": key2,
                "length_m": length_m,
                "raw_choice": raw_choice,
                "raw_integration": raw_integration,
                "raw_connectivity": raw_connectivity,
                "raw_control": raw_control,
                "raw_depth": raw_depth,
            }
        )

    if not parsed_edges:
        return _empty_result(mode, coord_type="gcj02", radii_m=local_radii, metric=render_metric)

    # Control can be missing or mapped to an almost-constant column in some depthmap exports.
    # In that case we fall back to a topology-derived control proxy so rendering does not collapse.
    def _build_topology_control_values() -> Tuple[List[float], Dict[Tuple[float, float], float]]:
        deg_by_node = {key: len(neighbors) for key, neighbors in neighbor_sets.items()}
        control_by_node: Dict[Tuple[float, float], float] = {}
        for key, neighbors in neighbor_sets.items():
            control_val = 0.0
            for nb in neighbors:
                nb_deg = int(deg_by_node.get(nb, 0))
                if nb_deg > 0:
                    control_val += 1.0 / float(nb_deg)
            control_by_node[key] = control_val
        edge_values: List[float] = []
        for item in parsed_edges:
            c1 = control_by_node.get(item["key1"])
            c2 = control_by_node.get(item["key2"])
            finite_vals = [float(v) for v in (c1, c2) if v is not None and math.isfinite(float(v))]
            if not finite_vals:
                item["raw_control_topology"] = None
                continue
            value = sum(finite_vals) / float(len(finite_vals))
            item["raw_control_topology"] = value
            edge_values.append(value)
        return edge_values, control_by_node

    control_values_from_depthmap = list(metric_values_control_raw)
    control_col_source = str(control_col or "")
    control_topology_values, _ = _build_topology_control_values()
    control_depthmap_spread = 0.0
    if control_values_from_depthmap:
        control_depthmap_spread = float(max(control_values_from_depthmap) - min(control_values_from_depthmap))
    use_topology_control_fallback = (
        (not control_values_from_depthmap)
        or (control_depthmap_spread <= 1e-12 and len(control_topology_values) > 0)
    )
    if use_topology_control_fallback and control_topology_values:
        logger.warning(
            "[road-syntax] control fallback activated source=%s depthmap_valid=%d depthmap_spread=%.6g topology_valid=%d",
            str(control_col or ""),
            len(control_values_from_depthmap),
            control_depthmap_spread,
            len(control_topology_values),
        )
        metric_values_control_raw = control_topology_values
        control_col_source = "topology_fallback"
        for item in parsed_edges:
            raw_topology = item.get("raw_control_topology")
            item["raw_control"] = raw_topology if raw_topology is not None else item.get("raw_control")

    choice_bounds = _metric_bounds(metric_values_choice)
    integ_bounds = _metric_bounds(metric_values_integ)
    conn_bounds: Optional[Tuple[float, float]] = None
    if metric_values_conn_raw:
        conn_bounds = (min(metric_values_conn_raw), max(metric_values_conn_raw))
    control_bounds: Optional[Tuple[float, float]] = None
    if metric_values_control_raw:
        control_bounds = (min(metric_values_control_raw), max(metric_values_control_raw))
    depth_bounds: Optional[Tuple[float, float]] = None
    if metric_values_depth_raw:
        depth_bounds = (min(metric_values_depth_raw), max(metric_values_depth_raw))

    global_choice_values: List[float] = []
    global_integ_values: List[float] = []
    global_conn_values_raw: List[float] = []
    global_control_values: List[float] = []
    global_depth_values: List[float] = []
    local_choice_values: Dict[str, List[float]] = {label: [] for label in local_labels}
    local_integ_values: Dict[str, List[float]] = {label: [] for label in local_labels}
    node_integ_sum: Dict[Tuple[float, float], float] = {}
    node_integ_cnt: Dict[Tuple[float, float], int] = {}

    scored_edges: List[Dict[str, Any]] = []
    for item in parsed_edges:
        choice_by_label: Dict[str, float] = {}
        integ_by_label: Dict[str, float] = {}

        for label in allow_labels:
            choice_by_label[label] = _norm(item["raw_choice"].get(label), choice_bounds.get(label))
            integ_by_label[label] = _norm(item["raw_integration"].get(label), integ_bounds.get(label))

        global_choice_values.append(choice_by_label.get("global", 0.0))
        global_integ_values.append(integ_by_label.get("global", 0.0))
        for label in local_labels:
            local_choice_values[label].append(choice_by_label.get(label, 0.0))
            local_integ_values[label].append(integ_by_label.get(label, 0.0))

        default_choice = choice_by_label.get(default_radius_label, choice_by_label.get("global", 0.0))
        default_integ = integ_by_label.get(default_radius_label, integ_by_label.get("global", 0.0))
        raw_connectivity = item.get("raw_connectivity")
        connectivity_score = _norm(raw_connectivity, conn_bounds)
        raw_control = item.get("raw_control")
        control_score: Optional[float] = None
        if raw_control is not None and control_bounds is not None and math.isfinite(float(raw_control)):
            control_score = _norm(float(raw_control), control_bounds)
        raw_depth = item.get("raw_depth")
        depth_score: Optional[float] = None
        if raw_depth is not None and depth_bounds is not None and math.isfinite(float(raw_depth)):
            depth_score = _norm(float(raw_depth), depth_bounds)
        if raw_connectivity is not None and math.isfinite(float(raw_connectivity)):
            global_conn_values_raw.append(float(raw_connectivity))
        if control_score is not None:
            global_control_values.append(float(control_score))
        if depth_score is not None:
            global_depth_values.append(float(depth_score))

        out1 = _to_output_coord(item["x1"], item["y1"], output_coord_type="gcj02")
        out2 = _to_output_coord(item["x2"], item["y2"], output_coord_type="gcj02")

        props: Dict[str, Any] = {
            "length_m": _safe_round(item["length_m"], 2),
            "choice_score": _safe_round(default_choice, 8),
            "integration_score": _safe_round(default_integ, 8),
            "accessibility_score": _safe_round(default_integ, 8),
            "connectivity_score": _safe_round(connectivity_score, 8),
            "degree_score": 0.0,
            "intelligibility_score": 0.0,
            "choice_global": _safe_round(choice_by_label.get("global", 0.0), 8),
            "integration_global": _safe_round(integ_by_label.get("global", 0.0), 8),
            "accessibility_global": _safe_round(integ_by_label.get("global", 0.0), 8),
            "rank_quantile_choice": 0.0,
            "rank_quantile_integration": 0.0,
            "rank_quantile_accessibility": 0.0,
            "is_skeleton_choice_top20": False,
            "is_skeleton_integration_top20": False,
        }
        for label in local_labels:
            props[f"choice_{label}"] = _safe_round(choice_by_label.get(label, 0.0), 8)
            props[f"integration_{label}"] = _safe_round(integ_by_label.get(label, 0.0), 8)
            props[f"accessibility_{label}"] = _safe_round(integ_by_label.get(label, 0.0), 8)
        if control_score is not None:
            props["control_score"] = _safe_round(control_score, 8)
            props["control_global"] = _safe_round(control_score, 8)
        if depth_score is not None:
            props["depth_score"] = _safe_round(depth_score, 8)
            props["depth_global"] = _safe_round(depth_score, 8)

        edge_integ_global = float(integ_by_label.get("global", 0.0))
        endpoint_keys = [item["key1"], item["key2"]]
        if endpoint_keys[0] == endpoint_keys[1]:
            endpoint_keys = endpoint_keys[:1]
        for node_key in endpoint_keys:
            node_integ_sum[node_key] = float(node_integ_sum.get(node_key, 0.0)) + edge_integ_global
            node_integ_cnt[node_key] = int(node_integ_cnt.get(node_key, 0)) + 1

        scored_edges.append(
            {
                "metric": default_integ if render_metric == "integration" else default_choice,
                "key1": item["key1"],
                "key2": item["key2"],
                "feature": {
                    "type": "Feature",
                    "properties": props,
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [_safe_round(out1[0], 6), _safe_round(out1[1], 6)],
                            [_safe_round(out2[0], 6), _safe_round(out2[1], 6)],
                        ],
                    },
                },
            }
        )

    degree_by_node: Dict[Tuple[float, float], float] = {
        key: float(len(neighbors))
        for key, neighbors in neighbor_sets.items()
    }
    degree_values = [v for v in degree_by_node.values() if math.isfinite(v)]
    if degree_values:
        degree_bounds = (min(degree_values), max(degree_values))
    else:
        degree_bounds = None
    degree_score_by_node: Dict[Tuple[float, float], float] = {
        key: _norm(value, degree_bounds)
        for key, value in degree_by_node.items()
    }
    integ_global_by_node: Dict[Tuple[float, float], float] = {}
    for key in neighbor_sets.keys():
        cnt = int(node_integ_cnt.get(key, 0))
        if cnt <= 0:
            integ_global_by_node[key] = 0.0
            continue
        integ_global_by_node[key] = max(0.0, min(1.0, float(node_integ_sum.get(key, 0.0)) / float(cnt)))

    intelligibility_x: List[float] = []
    intelligibility_y: List[float] = []
    for scored in scored_edges:
        props = ((scored.get("feature") or {}).get("properties") or {})
        connectivity_value = float(props.get("connectivity_score", 0.0))
        integration_value = float(props.get("integration_global", 0.0))
        if not (math.isfinite(connectivity_value) and math.isfinite(integration_value)):
            continue
        intelligibility_x.append(connectivity_value)
        intelligibility_y.append(integration_value)
    intelligibility_corr = _pearson_corr(intelligibility_x, intelligibility_y)
    intelligibility_r2 = intelligibility_corr * intelligibility_corr
    reg_slope, reg_intercept = _linear_regression(intelligibility_x, intelligibility_y)
    scatter_pairs = list(zip(intelligibility_x, intelligibility_y))
    sampled_scatter = _sample_scatter_points(scatter_pairs, max_points=3000, bins=20)

    def _resolve_rank_metric(props: Dict[str, Any], prefix: str) -> float:
        local_available = False
        if prefix == "choice":
            local_available = default_choice_has_local
        elif prefix in ("integration", "accessibility"):
            local_available = default_integration_has_local
        local_key = f"{prefix}_{default_radius_label}"
        global_key = f"{prefix}_global"
        if local_available and local_key in props:
            val = float(props.get(local_key, 0.0))
            if math.isfinite(val):
                return val
        val = float(props.get(global_key, props.get(f"{prefix}_score", 0.0)))
        return val if math.isfinite(val) else 0.0

    choice_rank_values: List[float] = []
    integ_rank_values: List[float] = []
    access_rank_values: List[float] = []
    for scored in scored_edges:
        props = ((scored.get("feature") or {}).get("properties") or {})
        choice_rank_values.append(_resolve_rank_metric(props, "choice"))
        integ_rank_values.append(_resolve_rank_metric(props, "integration"))
        access_rank_values.append(_resolve_rank_metric(props, "accessibility"))

    choice_sorted = sorted(v for v in choice_rank_values if math.isfinite(v))
    integ_sorted = sorted(v for v in integ_rank_values if math.isfinite(v))
    access_sorted = sorted(v for v in access_rank_values if math.isfinite(v))

    for scored in scored_edges:
        key1 = scored.get("key1")
        key2 = scored.get("key2")
        degree_1 = float(degree_score_by_node.get(key1, 0.0))
        degree_2 = float(degree_score_by_node.get(key2, 0.0))
        degree_score = max(0.0, min(1.0, (degree_1 + degree_2) / 2.0))
        props = ((scored.get("feature") or {}).get("properties") or {})
        connectivity_score = float(props.get("connectivity_score", degree_score))
        if not math.isfinite(connectivity_score):
            connectivity_score = degree_score
        connectivity_score = max(0.0, min(1.0, connectivity_score))
        props["connectivity_score"] = _safe_round(connectivity_score, 8)
        props["degree_score"] = _safe_round(degree_score, 8)
        # Keep per-edge field for compatibility, but bind it to the global intelligibility result.
        props["intelligibility_score"] = _safe_round(intelligibility_corr, 8)

        choice_rank = _percentile_rank(choice_sorted, _resolve_rank_metric(props, "choice"))
        integ_rank = _percentile_rank(integ_sorted, _resolve_rank_metric(props, "integration"))
        access_rank = _percentile_rank(access_sorted, _resolve_rank_metric(props, "accessibility"))
        props["rank_quantile_choice"] = _safe_round(choice_rank, 8)
        props["rank_quantile_integration"] = _safe_round(integ_rank, 8)
        props["rank_quantile_accessibility"] = _safe_round(access_rank, 8)
        props["is_skeleton_choice_top20"] = bool(choice_rank >= 0.8)
        props["is_skeleton_integration_top20"] = bool(integ_rank >= 0.8)

    node_features: List[Dict[str, Any]] = []
    for node_key, deg in degree_by_node.items():
        lon_wgs, lat_wgs = node_key
        lon_out, lat_out = _to_output_coord(lon_wgs, lat_wgs, output_coord_type="gcj02")
        degree_raw = float(deg)
        degree_score = float(degree_score_by_node.get(node_key, 0.0))
        integ_global = float(integ_global_by_node.get(node_key, 0.0))
        node_id = f"{_safe_round(lon_out, 6):.6f},{_safe_round(lat_out, 6):.6f}"
        node_features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [_safe_round(lon_out, 6), _safe_round(lat_out, 6)],
                },
                "properties": {
                    "node_id": node_id,
                    "degree": int(round(degree_raw)),
                    "degree_score": _safe_round(degree_score, 8),
                    "integration_global": _safe_round(integ_global, 8),
                },
            }
        )

    if max_edge_features is None:
        max_features = len(scored_edges)
    else:
        max_features = max(100, int(max_edge_features))
    features_out = [item["feature"] for item in scored_edges[:max_features]] if include_geojson else []
    pre_merge_feature_count = len(features_out)
    if include_geojson and merge_geojson_edges and len(features_out) >= 2:
        features_out = _merge_linestring_features(
            features_out,
            bucket_step=merge_bucket_step,
            angle_cos_min=0.92,
        )
    rendered_edge_count = len(features_out) if include_geojson else 0
    raw_edge_count = int(len(parsed_edges))
    if pre_merge_feature_count <= 0:
        edge_merge_ratio = 1.0
    else:
        edge_merge_ratio = max(0.0, min(1.0, float(rendered_edge_count) / float(pre_merge_feature_count)))

    node_count = len(neighbor_sets)
    avg_degree = 0.0
    if node_count > 0:
        avg_degree = sum(len(v) for v in neighbor_sets.values()) / float(node_count)

    def _avg(values: List[float]) -> float:
        finite = [float(v) for v in values if math.isfinite(float(v))]
        if not finite:
            return 0.0
        return sum(finite) / float(len(finite))

    avg_choice_global = _avg(global_choice_values)
    avg_integration_global = _avg(global_integ_values)
    avg_connectivity_value = _avg(global_conn_values_raw) if global_conn_values_raw else avg_degree
    avg_control_value = _avg(global_control_values)
    avg_depth_value = _avg(global_depth_values)
    control_valid_count = len(metric_values_control_raw)
    depth_valid_count = len(metric_values_depth_raw)

    avg_choice_by_radius: Dict[str, float] = {
        label: _avg(local_choice_values.get(label, []))
        for label in local_labels
    }
    avg_integration_by_radius: Dict[str, float] = {
        label: _avg(local_integ_values.get(label, []))
        for label in local_labels
    }

    avg_choice_local = avg_choice_by_radius.get(default_radius_label, avg_choice_global)
    avg_integration_local = avg_integration_by_radius.get(default_radius_label, avg_integration_global)

    default_webgl_metric_field = str(arcgis_metric_field or "").strip()
    if not default_webgl_metric_field:
        default_webgl_metric_field = "integration_score" if render_metric == "integration" else "accessibility_score"
    webgl_payload: Dict[str, Any] = {
        "enabled": False,
        "backend": "none",
        "status": "disabled",
        "metric_field": default_webgl_metric_field,
        "coord_type": "gcj02",
        "roads": {
            "type": "FeatureCollection",
            "features": [],
            "count": 0,
        },
        "elapsed_ms": 0.0,
    }
    if use_arcgis_webgl and include_geojson and features_out:
        bridge_started = time.perf_counter()
        try:
            arcgis_result = run_arcgis_road_syntax_webgl(
                road_features=features_out,
                metric_field=default_webgl_metric_field,
                target_coord_type="gcj02",
                arcgis_python_path=arcgis_python_path,
                timeout_sec=int(max(5, int(arcgis_timeout_sec or 20))),
            )
            webgl_payload = {
                "enabled": True,
                "backend": "arcgis_bridge",
                "status": str(arcgis_result.get("status") or "ok"),
                "metric_field": str(arcgis_result.get("metric_field") or default_webgl_metric_field),
                "coord_type": str(arcgis_result.get("coord_type") or "gcj02"),
                "roads": arcgis_result.get("roads")
                or {
                    "type": "FeatureCollection",
                    "features": [],
                    "count": 0,
                },
                "elapsed_ms": _safe_round((time.perf_counter() - bridge_started) * 1000.0, 2),
            }
        except ArcGISRoadSyntaxBridgeError as exc:
            webgl_payload = {
                "enabled": False,
                "backend": "arcgis_bridge",
                "status": f"bridge_error: {exc}",
                "metric_field": default_webgl_metric_field,
                "coord_type": "gcj02",
                "roads": {
                    "type": "FeatureCollection",
                    "features": [],
                    "count": 0,
                },
                "elapsed_ms": _safe_round((time.perf_counter() - bridge_started) * 1000.0, 2),
            }

    return {
        "summary": {
            "node_count": int(node_count),
            "edge_count": raw_edge_count,
            "rendered_edge_count": int(rendered_edge_count),
            "edge_merge_ratio": _safe_round(edge_merge_ratio, 6),
            "network_length_km": _safe_round(total_length_m / 1000.0, 4),
            "avg_degree": _safe_round(avg_degree, 4),
            "avg_closeness": _safe_round(avg_integration_global, 8),
            "avg_choice": _safe_round(avg_choice_global, 8),
            "avg_accessibility_global": _safe_round(avg_integration_global, 8),
            "avg_connectivity": _safe_round(avg_connectivity_value, 8),
            "avg_control": _safe_round(avg_control_value, 8),
            "avg_depth": _safe_round(avg_depth_value, 8),
            "control_source_column": str(control_col_source or ""),
            "control_valid_count": int(control_valid_count),
            "depth_source_column": str(depth_col or ""),
            "depth_valid_count": int(depth_valid_count),
            "avg_intelligibility": _safe_round(intelligibility_corr, 8),
            "avg_intelligibility_r2": _safe_round(intelligibility_r2, 8),
            "avg_integration_global": _safe_round(avg_integration_global, 8),
            "avg_choice_global": _safe_round(avg_choice_global, 8),
            "avg_integration_local": _safe_round(avg_integration_local, 8),
            "avg_choice_local": _safe_round(avg_choice_local, 8),
            "avg_integration_by_radius": {
                label: _safe_round(value, 8)
                for label, value in avg_integration_by_radius.items()
            },
            "avg_choice_by_radius": {
                label: _safe_round(value, 8)
                for label, value in avg_choice_by_radius.items()
            },
            "radius_labels": local_labels,
            "mode": mode,
            "coord_type": "gcj02",
            "default_metric": render_metric,
            "default_radius_label": default_radius_label,
            "analysis_engine": "depthmapxcli",
        },
        "top_nodes": [],
        "roads": {
            "type": "FeatureCollection",
            "features": features_out,
            "count": len(features_out),
        },
        "nodes": {
            "type": "FeatureCollection",
            "features": node_features,
            "count": len(node_features),
        },
        "diagnostics": {
            "intelligibility_scatter": [
                {"x": _safe_round(x, 8), "y": _safe_round(y, 8)}
                for x, y in sampled_scatter
            ],
            "regression": {
                "slope": _safe_round(reg_slope, 8),
                "intercept": _safe_round(reg_intercept, 8),
                "r": _safe_round(intelligibility_corr, 8),
                "r2": _safe_round(intelligibility_r2, 8),
                "n": int(len(intelligibility_x)),
            },
        },
        "webgl": webgl_payload,
    }
