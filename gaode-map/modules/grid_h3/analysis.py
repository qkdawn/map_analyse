import json
import math
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import h3
import numpy as np
from scipy.stats import entropy as scipy_entropy

from modules.gaode_service.utils.transform_posi import gcj02_to_wgs84

from .arcgis_bridge import run_arcgis_h3_analysis
from .core import build_h3_grid_feature_collection

CategoryKey = str
CategoryRule = Tuple[CategoryKey, str, Tuple[str, ...]]

_TYPE_MAP_PATH = Path(__file__).resolve().parents[2] / "share" / "type_map.json"


def _normalize_typecode(value: Any) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) >= 6:
        return digits[:6]
    return digits


def _build_category_rules() -> List[CategoryRule]:
    try:
        raw = json.loads(_TYPE_MAP_PATH.read_text(encoding="utf-8"))
        groups = raw.get("groups") or []
        rules: List[CategoryRule] = []
        for idx, group in enumerate(groups):
            key = str(group.get("id") or f"group-{idx + 1}")
            label = str(group.get("title") or key)
            codes: List[str] = []
            for item in (group.get("items") or []):
                for code in str(item.get("types") or "").split("|"):
                    normalized = _normalize_typecode(code)
                    if normalized:
                        codes.append(normalized)
            deduped_codes: List[str] = []
            seen = set()
            for code in codes:
                if code in seen:
                    continue
                seen.add(code)
                deduped_codes.append(code)
            rules.append((key, label, tuple(deduped_codes)))
        if rules:
            return rules
    except Exception:
        pass

    return [
        ("group-7", "餐饮", ("05",)),
        ("group-6", "购物", ("06",)),
        ("group-4", "商务住宅", ("12",)),
        ("group-3", "交通", ("15",)),
        ("group-2", "旅游", ("11",)),
        ("group-13", "科教文化", ("14",)),
        ("group-10", "医疗", ("09",)),
    ]


CATEGORY_RULES: List[CategoryRule] = _build_category_rules()
CATEGORY_KEYS: Tuple[str, ...] = tuple(item[0] for item in CATEGORY_RULES)
_TYPECODE_TO_CATEGORY: Dict[str, str] = {}
_PREFIX2_TO_CATEGORY: Dict[str, str] = {}
for category_key, _label, typecodes in CATEGORY_RULES:
    for code in typecodes:
        _TYPECODE_TO_CATEGORY.setdefault(code, category_key)
        if len(code) >= 2:
            _PREFIX2_TO_CATEGORY.setdefault(code[:2], category_key)


def _empty_category_counts() -> Dict[CategoryKey, int]:
    return {key: 0 for key in CATEGORY_KEYS}


def _safe_round(value: Optional[float], ndigits: int = 6) -> Optional[float]:
    if value is None:
        return None
    try:
        if not math.isfinite(value):
            return None
        return round(float(value), ndigits)
    except Exception:
        return None


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        f = float(value)
        if not math.isfinite(f):
            return None
        return f
    except Exception:
        return None


def _calc_continuous_stats(values: List[Optional[float]]) -> Dict[str, Any]:
    valid = np.asarray(
        [
            float(v)
            for v in values
            if isinstance(v, (int, float, np.floating)) and math.isfinite(float(v))
        ],
        dtype=float,
    )
    if valid.size <= 0:
        return {
            "count": 0,
            "mean": None,
            "std": None,
            "min": None,
            "max": None,
            "p10": None,
            "p50": None,
            "p90": None,
        }
    return {
        "count": int(valid.size),
        "mean": _safe_round(float(np.mean(valid)), 6),
        "std": _safe_round(float(np.std(valid, ddof=0)), 6),
        "min": _safe_round(float(np.min(valid)), 6),
        "max": _safe_round(float(np.max(valid)), 6),
        "p10": _safe_round(float(np.percentile(valid, 10)), 6),
        "p50": _safe_round(float(np.percentile(valid, 50)), 6),
        "p90": _safe_round(float(np.percentile(valid, 90)), 6),
    }


def _build_gi_render_meta() -> Dict[str, Any]:
    return {
        "mode": "fixed_z",
        "min": -3.0,
        "max": 3.0,
        "center": 0.0,
    }


def _build_lisa_render_meta(lisa_i_stats: Dict[str, Any]) -> Dict[str, Any]:
    mean_val = _safe_float(lisa_i_stats.get("mean"))
    std_val = _safe_float(lisa_i_stats.get("std"))
    min_val = _safe_float(lisa_i_stats.get("min"))
    max_val = _safe_float(lisa_i_stats.get("max"))
    count = int(lisa_i_stats.get("count") or 0)
    degraded = bool(
        count <= 1
        or mean_val is None
        or std_val is None
        or (not math.isfinite(std_val))
        or std_val <= 0.0
    )

    if degraded:
        center = _safe_round(mean_val, 6) if mean_val is not None else 0.0
        return {
            "mode": "stddev",
            "mean": _safe_round(mean_val, 6),
            "std": _safe_round(std_val, 6),
            "min": _safe_round(min_val, 6),
            "max": _safe_round(max_val, 6),
            "clip_min": center,
            "clip_max": center,
            "degraded": True,
            "message": "LMiIndex方差不足",
        }

    p10_val = _safe_float(lisa_i_stats.get("p10"))
    p90_val = _safe_float(lisa_i_stats.get("p90"))
    std_clip_min = mean_val - 2.0 * std_val
    std_clip_max = mean_val + 2.0 * std_val
    clip_min_raw = max(
        v for v in [std_clip_min, p10_val, min_val] if v is not None and math.isfinite(v)
    )
    clip_max_raw = min(
        v for v in [std_clip_max, p90_val, max_val] if v is not None and math.isfinite(v)
    )
    if clip_max_raw <= clip_min_raw:
        clip_min_raw = p10_val if p10_val is not None else min_val
        clip_max_raw = p90_val if p90_val is not None else max_val
    if clip_min_raw is None or clip_max_raw is None or clip_max_raw <= clip_min_raw:
        clip_min_raw = min_val
        clip_max_raw = max_val
    if clip_min_raw is None or clip_max_raw is None or clip_max_raw <= clip_min_raw:
        clip_min_raw = mean_val - 2.0 * std_val
        clip_max_raw = mean_val + 2.0 * std_val

    clip_min = _safe_round(clip_min_raw, 6)
    clip_max = _safe_round(clip_max_raw, 6)
    return {
        "mode": "stddev",
        "mean": _safe_round(mean_val, 6),
        "std": _safe_round(std_val, 6),
        "min": _safe_round(min_val, 6),
        "max": _safe_round(max_val, 6),
        "clip_min": clip_min,
        "clip_max": clip_max,
        "degraded": False,
        "message": None,
    }


def _new_local_spatial_stat() -> Dict[str, Any]:
    return {
        "lisa_i": None,
        "lisa_z_score": None,
        "gi_star_value": None,
        "gi_star_z_score": None,
    }


def _infer_category_key(type_text: Optional[str]) -> Optional[CategoryKey]:
    if not type_text:
        return None
    code = _normalize_typecode(type_text)
    if len(code) < 2:
        return None
    if code in _TYPECODE_TO_CATEGORY:
        return _TYPECODE_TO_CATEGORY[code]
    return _PREFIX2_TO_CATEGORY.get(code[:2])


def _latlng_to_cell(lat: float, lng: float, resolution: int) -> Optional[str]:
    try:
        if hasattr(h3, "latlng_to_cell"):
            return h3.latlng_to_cell(lat, lng, resolution)
        if hasattr(h3, "geo_to_h3"):
            return h3.geo_to_h3(lat, lng, resolution)
    except Exception:
        return None
    return None


def _cell_area_km2(cell_id: str, resolution: int) -> float:
    try:
        if hasattr(h3, "cell_area"):
            return float(h3.cell_area(cell_id, unit="km^2"))
        if hasattr(h3, "hex_area"):
            return float(h3.hex_area(resolution, unit="km^2"))
    except Exception:
        return 0.0
    return 0.0


def _neighbors(cell_id: str, ring_size: int) -> List[str]:
    try:
        if hasattr(h3, "grid_disk"):
            return list(h3.grid_disk(cell_id, ring_size))
        if hasattr(h3, "k_ring"):
            return list(h3.k_ring(cell_id, ring_size))
    except Exception:
        return []
    return []


def _normalize_neighbor_ring(ring_size: Any, default: int = 1) -> int:
    try:
        ring = int(float(ring_size))
    except Exception:
        ring = int(default)
    return max(1, min(3, ring))


def _ring_to_arcgis_knn(ring_size: Any) -> int:
    # H3 disk neighbors (excluding self): ring=1 -> 6, ring=2 -> 18, ring=3 -> 36
    ring = _normalize_neighbor_ring(ring_size, default=1)
    return int(3 * ring * (ring + 1))


def _has_density_variance(stats_by_cell: Dict[str, Dict[str, Any]], tol: float = 1e-12) -> bool:
    if not stats_by_cell:
        return False
    values = [
        float(bucket.get("density_poi_per_km2") or 0.0)
        for bucket in stats_by_cell.values()
    ]
    if len(values) < 2:
        return False
    return (max(values) - min(values)) > float(tol)


def _shannon_entropy(category_counts: Dict[CategoryKey, int]) -> float:
    counts = np.asarray(list(category_counts.values()), dtype=float)
    if counts.size <= 0:
        return 0.0
    counts = counts[counts > 0]
    if counts.size <= 0:
        return 0.0
    probs = counts / counts.sum()
    return float(scipy_entropy(probs, base=math.e))


def aggregate_pois_to_h3(
    grid_ids: List[str],
    pois: List[Dict[str, Any]],
    resolution: int,
    poi_coord_type: Literal["gcj02", "wgs84"] = "gcj02",
) -> Tuple[Dict[str, Dict[str, Any]], int, Dict[CategoryKey, int]]:
    grid_set = set(grid_ids)
    global_category_counts = _empty_category_counts()
    stats_by_cell: Dict[str, Dict[str, Any]] = {
        cid: {
            "poi_count": 0,
            "category_counts": _empty_category_counts(),
            "density_poi_per_km2": 0.0,
            "local_entropy": 0.0,
            "neighbor_mean_density": 0.0,
            "neighbor_mean_entropy": 0.0,
            "neighbor_count": 0,
        }
        for cid in grid_ids
    }
    assigned_poi_count = 0

    for poi in pois or []:
        location = poi.get("location")
        if not isinstance(location, (list, tuple)) or len(location) < 2:
            continue
        try:
            lng = float(location[0])
            lat = float(location[1])
        except (TypeError, ValueError):
            continue

        if poi_coord_type == "gcj02":
            lng, lat = gcj02_to_wgs84(lng, lat)
        cell_id = _latlng_to_cell(lat, lng, resolution)
        if not cell_id or cell_id not in grid_set:
            continue

        assigned_poi_count += 1
        bucket = stats_by_cell[cell_id]
        bucket["poi_count"] += 1
        category_key = _infer_category_key(poi.get("type"))
        if category_key:
            bucket["category_counts"][category_key] += 1
            global_category_counts[category_key] += 1

    return stats_by_cell, assigned_poi_count, global_category_counts


def compute_cell_metrics(
    stats_by_cell: Dict[str, Dict[str, Any]],
    resolution: int,
) -> None:
    for cell_id, stats in stats_by_cell.items():
        area_km2 = _cell_area_km2(cell_id, resolution)
        poi_count = stats["poi_count"]
        density = (poi_count / area_km2) if area_km2 > 0 else 0.0
        entropy = _shannon_entropy(stats["category_counts"])
        stats["density_poi_per_km2"] = float(density)
        stats["local_entropy"] = float(entropy)


def compute_neighbor_metrics(
    stats_by_cell: Dict[str, Dict[str, Any]],
    neighbor_ring: int = 1,
) -> None:
    cell_ids = list(stats_by_cell.keys())
    if not cell_ids:
        return

    cell_set = set(cell_ids)
    for cid in cell_ids:
        neighbor_ids = [
            nid for nid in _neighbors(cid, neighbor_ring)
            if nid in cell_set and nid != cid
        ]
        neighbor_count = int(len(neighbor_ids))
        stats = stats_by_cell[cid]
        stats["neighbor_count"] = neighbor_count
        if neighbor_count <= 0:
            stats["neighbor_mean_density"] = 0.0
            stats["neighbor_mean_entropy"] = 0.0
            continue

        density_sum = 0.0
        entropy_sum = 0.0
        for nid in neighbor_ids:
            nstats = stats_by_cell.get(nid) or {}
            density_sum += float(nstats.get("density_poi_per_km2", 0.0) or 0.0)
            entropy_sum += float(nstats.get("local_entropy", 0.0) or 0.0)

        stats["neighbor_mean_density"] = float(density_sum / neighbor_count)
        stats["neighbor_mean_entropy"] = float(entropy_sum / neighbor_count)


def compute_global_moran_i(
    stats_by_cell: Dict[str, Dict[str, Any]],
    value_key: str = "density_poi_per_km2",
    neighbor_ring: int = 1,
) -> Optional[float]:
    cell_ids = list(stats_by_cell.keys())
    n = len(cell_ids)
    if n < 2:
        return None

    values = {cid: float(stats_by_cell[cid].get(value_key, 0.0) or 0.0) for cid in cell_ids}
    mean_value = sum(values.values()) / n
    denominator = sum((values[cid] - mean_value) ** 2 for cid in cell_ids)
    if denominator <= 0:
        return None

    numerator = 0.0
    s0 = 0
    cell_set = set(cell_ids)
    for cid in cell_ids:
        neighbors = [nid for nid in _neighbors(cid, neighbor_ring) if nid in cell_set and nid != cid]
        for nid in neighbors:
            numerator += (values[cid] - mean_value) * (values[nid] - mean_value)
            s0 += 1

    if s0 <= 0:
        return None
    moran_i = (n / s0) * (numerator / denominator)
    return _safe_round(moran_i, 6)


def build_local_spatial_stats_from_arcgis(
    stats_by_cell: Dict[str, Dict[str, Any]],
    arcgis_cells: List[Dict[str, Any]],
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, int]]:
    local_stats: Dict[str, Dict[str, Any]] = {
        cid: _new_local_spatial_stat() for cid in stats_by_cell.keys()
    }
    if not arcgis_cells:
        return _finalize_native_spatial_fields(local_stats)

    for item in arcgis_cells:
        h3_id = str((item or {}).get("h3_id") or "")
        if not h3_id or h3_id not in local_stats:
            continue
        stats = local_stats[h3_id]
        gi_z = _safe_round(_safe_float((item or {}).get("gi_z_score")), 6)
        stats.update(
            {
                "lisa_i": _safe_round(_safe_float((item or {}).get("lisa_i")), 6),
                "lisa_z_score": _safe_round(_safe_float((item or {}).get("lisa_z_score")), 6),
                "gi_star_value": None,
                "gi_star_z_score": gi_z,
            }
        )
    return _finalize_native_spatial_fields(local_stats)


def _empty_spatial_structure_counts() -> Dict[str, int]:
    return {}


def _finalize_native_spatial_fields(
    local_stats: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, int]]:
    counts = _empty_spatial_structure_counts()
    return local_stats, counts


def build_chart_payload(
    global_category_counts: Dict[CategoryKey, int],
    density_values: List[float],
) -> Dict[str, Any]:
    labels = [label for _key, label, _codes in CATEGORY_RULES]
    keys = [key for key, _label, _codes in CATEGORY_RULES]
    values = [int(global_category_counts.get(key, 0)) for key in keys]

    # Fixed bins for consistent comparison between runs.
    edges = np.asarray([0, 1, 2, 5, 10, 20, 50, 100, 200], dtype=float)
    hist_labels = [f"{int(edges[i])}-{int(edges[i + 1])}" for i in range(len(edges) - 1)] + [f">={int(edges[-1])}"]
    hist_counts = np.zeros(len(hist_labels), dtype=np.int64)

    if density_values:
        density_arr = np.asarray(density_values, dtype=float)
        density_arr = density_arr[np.isfinite(density_arr)]
        if density_arr.size > 0:
            bin_edges = np.concatenate([edges, np.asarray([np.inf])])
            bin_indices = np.digitize(density_arr, bin_edges, right=False) - 1
            bin_indices = np.clip(bin_indices, 0, len(hist_labels) - 1)
            hist_counts = np.bincount(bin_indices, minlength=len(hist_labels))

    return {
        "category_distribution": {
            "labels": labels,
            "values": values,
        },
        "density_histogram": {
            "bins": hist_labels,
            "counts": [int(item) for item in hist_counts.tolist()],
        },
    }


def analyze_h3_grid(
    polygon: List[List[float]],
    resolution: int = 10,
    coord_type: Literal["gcj02", "wgs84"] = "gcj02",
    include_mode: Literal["intersects", "inside"] = "intersects",
    min_overlap_ratio: float = 0.0,
    pois: Optional[List[Dict[str, Any]]] = None,
    poi_coord_type: Literal["gcj02", "wgs84"] = "gcj02",
    neighbor_ring: int = 1,
    use_arcgis: bool = True,
    arcgis_python_path: Optional[str] = None,
    arcgis_neighbor_ring: int = 1,
    arcgis_knn_neighbors: Optional[int] = None,
    arcgis_export_image: bool = True,
    arcgis_timeout_sec: int = 240,
) -> Dict[str, Any]:
    grid = build_h3_grid_feature_collection(
        polygon_coords=polygon,
        resolution=resolution,
        coord_type=coord_type,
        include_mode=include_mode,
        min_overlap_ratio=min_overlap_ratio,
    )
    features = grid.get("features") or []
    grid_ids = [f.get("properties", {}).get("h3_id") for f in features if f.get("properties", {}).get("h3_id")]
    if not grid_ids:
        empty_charts = build_chart_payload(_empty_category_counts(), [])
        empty_gi_stats = _calc_continuous_stats([])
        empty_lisa_stats = _calc_continuous_stats([])
        return {
            "grid": grid,
            "summary": {
                "grid_count": 0,
                "poi_count": 0,
                "avg_density_poi_per_km2": 0.0,
                "avg_local_entropy": 0.0,
                "global_moran_i_density": None,
                "global_moran_z_score": None,
                "analysis_engine": "arcgis",
                "arcgis_status": None,
                "arcgis_image_url": None,
                "arcgis_image_url_gi": None,
                "arcgis_image_url_lisa": None,
                "gi_render_meta": _build_gi_render_meta(),
                "lisa_render_meta": _build_lisa_render_meta(empty_lisa_stats),
                "gi_z_stats": empty_gi_stats,
                "lisa_i_stats": empty_lisa_stats,
            },
            "charts": empty_charts,
        }

    stats_by_cell, assigned_poi_count, global_category_counts = aggregate_pois_to_h3(
        grid_ids=grid_ids,
        pois=pois or [],
        resolution=resolution,
        poi_coord_type=poi_coord_type,
    )
    compute_cell_metrics(stats_by_cell, resolution=resolution)
    neighbor_ring = _normalize_neighbor_ring(neighbor_ring, default=1)
    compute_neighbor_metrics(stats_by_cell, neighbor_ring=neighbor_ring)

    if not use_arcgis:
        raise RuntimeError("当前仅支持 ArcGIS 引擎")

    analysis_engine: Literal["arcgis"] = "arcgis"
    arcgis_status: Optional[str] = None
    arcgis_image_url: Optional[str] = None
    arcgis_image_url_gi: Optional[str] = None
    arcgis_image_url_lisa: Optional[str] = None
    global_moran_i: Optional[float] = None
    global_moran_z_score: Optional[float] = None
    local_spatial_stats = {cell_id: _new_local_spatial_stat() for cell_id in stats_by_cell.keys()}

    if _has_density_variance(stats_by_cell):
        try:
            arcgis_ring = _normalize_neighbor_ring(arcgis_neighbor_ring, default=neighbor_ring)
            arcgis_knn = _ring_to_arcgis_knn(arcgis_ring)
            arcgis_result = run_arcgis_h3_analysis(
                features=features,
                stats_by_cell=stats_by_cell,
                arcgis_python_path=arcgis_python_path,
                knn_neighbors=arcgis_knn,
                timeout_sec=arcgis_timeout_sec,
                export_image=arcgis_export_image,
            )
            gm = arcgis_result.get("global_moran") or {}
            global_moran_i = _safe_round(_safe_float(gm.get("i")), 6)
            global_moran_z_score = _safe_round(_safe_float(gm.get("z_score")), 6)
            local_spatial_stats, _ = build_local_spatial_stats_from_arcgis(
                stats_by_cell,
                arcgis_result.get("cells") or [],
            )
            arcgis_status = str(arcgis_result.get("status") or "ArcGIS计算完成")
            arcgis_image_url = arcgis_result.get("image_url")
            arcgis_image_url_gi = arcgis_result.get("image_url_gi") or arcgis_image_url
            arcgis_image_url_lisa = arcgis_result.get("image_url_lisa")
        except Exception as exc:
            raise RuntimeError(f"ArcGIS桥接失败: {exc}") from exc
    else:
        for stat in local_spatial_stats.values():
            stat.update(
                {
                    "lisa_i": 0.0,
                    "lisa_z_score": 0.0,
                    "gi_star_value": 0.0,
                    "gi_star_z_score": 0.0,
                }
            )
        arcgis_status = "ArcGIS已跳过：密度无差异"

    density_values: List[float] = []
    entropy_values: List[float] = []
    gi_z_values: List[Optional[float]] = []
    lisa_i_values: List[Optional[float]] = []
    for feature in features:
        props = feature.setdefault("properties", {})
        cell_id = props.get("h3_id")
        cell_stats = stats_by_cell.get(cell_id)
        if not cell_stats:
            continue
        local_stats = local_spatial_stats.get(cell_id, {})

        density = float(cell_stats["density_poi_per_km2"])
        entropy = float(cell_stats["local_entropy"])
        density_values.append(density)
        entropy_values.append(entropy)
        gi_z_values.append(_safe_float(local_stats.get("gi_star_z_score")))
        lisa_i_values.append(_safe_float(local_stats.get("lisa_i")))

        props.update(
            {
                "poi_count": int(cell_stats["poi_count"]),
                "density_poi_per_km2": _safe_round(density, 6) or 0.0,
                "local_entropy": _safe_round(entropy, 6) or 0.0,
                "neighbor_mean_density": _safe_round(cell_stats["neighbor_mean_density"], 6) or 0.0,
                "neighbor_mean_entropy": _safe_round(cell_stats["neighbor_mean_entropy"], 6) or 0.0,
                "neighbor_count": int(cell_stats["neighbor_count"]),
                "category_counts": cell_stats["category_counts"],
                "lisa_i": local_stats.get("lisa_i"),
                "lisa_z_score": local_stats.get("lisa_z_score"),
                "gi_star_value": local_stats.get("gi_star_value"),
                "gi_star_z_score": local_stats.get("gi_star_z_score"),
            }
        )

    grid_count = len(features)
    avg_density = (sum(density_values) / grid_count) if grid_count else 0.0
    avg_entropy = (sum(entropy_values) / grid_count) if grid_count else 0.0
    gi_z_stats = _calc_continuous_stats(gi_z_values)
    lisa_i_stats = _calc_continuous_stats(lisa_i_values)
    gi_render_meta = _build_gi_render_meta()
    lisa_render_meta = _build_lisa_render_meta(lisa_i_stats)

    return {
        "grid": {
            "type": "FeatureCollection",
            "features": features,
            "count": grid_count,
        },
        "summary": {
            "grid_count": grid_count,
            "poi_count": assigned_poi_count,
            "avg_density_poi_per_km2": _safe_round(avg_density, 6) or 0.0,
            "avg_local_entropy": _safe_round(avg_entropy, 6) or 0.0,
            "global_moran_i_density": global_moran_i,
            "global_moran_z_score": global_moran_z_score,
            "analysis_engine": analysis_engine,
            "arcgis_status": arcgis_status,
            "arcgis_image_url": arcgis_image_url,
            "arcgis_image_url_gi": arcgis_image_url_gi,
            "arcgis_image_url_lisa": arcgis_image_url_lisa,
            "gi_render_meta": gi_render_meta,
            "lisa_render_meta": lisa_render_meta,
            "gi_z_stats": gi_z_stats,
            "lisa_i_stats": lisa_i_stats,
        },
        "charts": build_chart_payload(global_category_counts, density_values),
    }
