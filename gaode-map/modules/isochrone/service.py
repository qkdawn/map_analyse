from __future__ import annotations

import asyncio
import math
import time
from typing import Any, List, Optional

from fastapi import HTTPException
from shapely.geometry import Point, Polygon, mapping
from shapely.ops import unary_union

from core.spatial import (
    geometry_has_area,
    pick_largest_polygon,
    polygon_from_payload,
    transform_polygon_payload_coords,
    transform_geometry_to_coord_type,
    transform_point_from_wgs84,
)
from modules.providers.amap.utils.transform_posi import gcj02_to_wgs84

from .core import get_isochrone_polygon
from .schemas import IsochroneDebugSampleRequest, IsochroneRequest


def _meters_per_degree_lon(lat_deg: float) -> float:
    lat_rad = math.radians(float(lat_deg))
    return max(1000.0, 111320.0 * abs(math.cos(lat_rad)))


def _segment_length_m(x1: float, y1: float, x2: float, y2: float, lat_ref: float) -> float:
    dx_m = (float(x2) - float(x1)) * _meters_per_degree_lon(lat_ref)
    dy_m = (float(y2) - float(y1)) * 111320.0
    return math.sqrt(dx_m * dx_m + dy_m * dy_m)


def _dedupe_points(points: List[List[float]], precision: int = 6) -> List[List[float]]:
    out: List[List[float]] = []
    seen = set()
    for pt in points:
        if not isinstance(pt, list) or len(pt) < 2:
            continue
        x = float(pt[0])
        y = float(pt[1])
        key = (round(x, precision), round(y, precision))
        if key in seen:
            continue
        seen.add(key)
        out.append([x, y])
    return out


def _limit_points_evenly(points: List[List[float]], limit: int) -> List[List[float]]:
    if len(points) <= limit:
        return points
    if limit <= 1:
        return [points[0]]
    span = len(points) - 1
    selected: List[List[float]] = []
    used = set()
    for i in range(limit):
        idx = int(round((i * span) / (limit - 1)))
        idx = min(max(idx, 0), len(points) - 1)
        if idx in used:
            continue
        used.add(idx)
        selected.append(points[idx])
    if not selected:
        return [points[0]]
    return selected


def _sample_boundary_points(poly: Polygon, step_m: float, cap: Optional[int] = 300) -> List[List[float]]:
    if not poly or poly.is_empty or not poly.exterior:
        return []
    coords = list(poly.exterior.coords)
    if len(coords) < 2:
        return []
    lat_ref = float(poly.centroid.y)
    sampled: List[List[float]] = []
    for i in range(len(coords) - 1):
        x1, y1 = float(coords[i][0]), float(coords[i][1])
        x2, y2 = float(coords[i + 1][0]), float(coords[i + 1][1])
        seg_len = _segment_length_m(x1, y1, x2, y2, lat_ref)
        steps = max(1, int(math.ceil(seg_len / max(1.0, step_m))))
        for k in range(steps):
            t = float(k) / float(steps)
            sampled.append([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t])
            if cap is not None and len(sampled) >= cap:
                return _dedupe_points(sampled)
    sampled.append([float(coords[-1][0]), float(coords[-1][1])])
    return _dedupe_points(sampled)


def _build_scope_sample_points(
    scope_poly: Polygon,
    center_lon: float,
    center_lat: float,
    *,
    boundary_step_m: float,
    inner_step_m: float,
    max_points: Optional[int],
) -> List[List[float]]:
    _ = inner_step_m
    boundary_cap = None if max_points is None else max(120, int(max_points) * 4)
    boundary_pts = _sample_boundary_points(scope_poly, float(boundary_step_m), cap=boundary_cap)
    if boundary_pts:
        if max_points is not None and len(boundary_pts) > int(max_points):
            return _limit_points_evenly(boundary_pts, int(max_points))
        return boundary_pts

    base_points: List[List[float]] = [[float(center_lon), float(center_lat)]]
    if scope_poly and not scope_poly.is_empty:
        point = scope_poly.representative_point()
        base_points.append([float(point.x), float(point.y)])
    deduped = _dedupe_points(base_points)
    if max_points is not None and len(deduped) > int(max_points):
        return _limit_points_evenly(deduped, int(max_points))
    return deduped


def _parse_clip_polygon(
    clip_polygon_raw: Optional[List[List[float]]],
    coord_type: str,
) -> Optional[Polygon]:
    if not clip_polygon_raw:
        return None
    if coord_type == "gcj02":
        clip_polygon_raw = transform_polygon_payload_coords(clip_polygon_raw, gcj02_to_wgs84)
    clip_geom = polygon_from_payload(clip_polygon_raw)
    if clip_geom.is_empty:
        raise HTTPException(400, "Invalid clip_polygon")
    clip_poly = pick_largest_polygon(clip_geom.buffer(0))
    if clip_poly is None:
        raise HTTPException(400, "Invalid clip_polygon")
    return clip_poly


async def calculate_isochrone_feature(payload: IsochroneRequest) -> dict[str, Any]:
    start = time.time()
    lat, lon = payload.lat, payload.lon
    if payload.coord_type == "gcj02":
        lon, lat = gcj02_to_wgs84(payload.lon, payload.lat)

    clip_poly = _parse_clip_polygon(payload.clip_polygon, payload.coord_type)
    sample_points: List[List[float]] = [[lon, lat]]
    if payload.origin_mode == "multi_sample":
        if clip_poly is None:
            raise HTTPException(400, "origin_mode=multi_sample requires clip_polygon")
        sample_points = _build_scope_sample_points(
            clip_poly,
            lon,
            lat,
            boundary_step_m=float(payload.sample_boundary_step_m),
            inner_step_m=float(payload.sample_inner_step_m),
            max_points=int(payload.sample_max_points) if payload.sample_max_points is not None else None,
        )
        if not sample_points:
            sample_points = [[lon, lat]]

    if payload.origin_mode == "multi_sample":
        sem = asyncio.Semaphore(8)

        async def _compute_one(point: List[float]):
            async with sem:
                return await asyncio.to_thread(
                    get_isochrone_polygon,
                    float(point[1]),
                    float(point[0]),
                    payload.time_min * 60,
                    payload.mode,
                )

        results = await asyncio.gather(*[_compute_one(point) for point in sample_points], return_exceptions=True)
        polygons = []
        for item in results:
            if isinstance(item, Exception):
                continue
            picked = pick_largest_polygon(item)
            if picked is not None and not picked.is_empty:
                polygons.append(picked)
        if clip_poly is not None:
            polygons.append(clip_poly)
        if not polygons:
            raise HTTPException(404, "Empty isochrone result")
        final_poly = unary_union(polygons)
        if not geometry_has_area(final_poly):
            raise HTTPException(404, "Empty isochrone result")
    else:
        poly_wgs84 = await asyncio.to_thread(get_isochrone_polygon, lat, lon, payload.time_min * 60, payload.mode)
        final_poly = pick_largest_polygon(poly_wgs84)
        if final_poly is None:
            raise HTTPException(404, "Empty isochrone result")

    should_clip_output = bool(payload.clip_output) if payload.clip_output is not None else payload.origin_mode != "multi_sample"
    if clip_poly is not None and should_clip_output:
        final_poly = final_poly.intersection(clip_poly)
        if not geometry_has_area(final_poly):
            raise HTTPException(404, "Empty isochrone result after clip")

    final_poly = transform_geometry_to_coord_type(final_poly, payload.coord_type)
    return {
        "type": "Feature",
        "properties": {
            "center": [payload.lon, payload.lat],
            "time_min": payload.time_min,
            "mode": payload.mode,
            "origin_mode": payload.origin_mode,
            "origin_count": len(sample_points),
            "scope_clipped": bool(payload.clip_polygon and should_clip_output),
            "calc_time_ms": int((time.time() - start) * 1000),
        },
        "geometry": mapping(final_poly),
    }


async def build_debug_isochrone_samples(payload: IsochroneDebugSampleRequest) -> dict[str, Any]:
    lat, lon = payload.lat, payload.lon
    if payload.coord_type == "gcj02":
        lon, lat = gcj02_to_wgs84(payload.lon, payload.lat)

    clip_poly = _parse_clip_polygon(payload.clip_polygon, payload.coord_type)
    if clip_poly is None:
        raise HTTPException(400, "Invalid clip_polygon")

    sample_points = _build_scope_sample_points(
        clip_poly,
        lon,
        lat,
        boundary_step_m=float(payload.sample_boundary_step_m),
        inner_step_m=220.0,
        max_points=int(payload.sample_max_points) if payload.sample_max_points is not None else None,
    )
    if not sample_points:
        sample_points = [[float(lon), float(lat)]]

    sem = asyncio.Semaphore(8)

    async def _compute_one(sample_id: str, seq: int, point: List[float]):
        async with sem:
            try:
                geom = await asyncio.to_thread(
                    get_isochrone_polygon,
                    float(point[1]),
                    float(point[0]),
                    payload.time_min * 60,
                    payload.mode,
                )
            except Exception as exc:
                return {"ok": False, "sample_id": sample_id, "seq": seq, "message": str(exc) or exc.__class__.__name__}

            if geom is None or getattr(geom, "is_empty", True):
                return {"ok": False, "sample_id": sample_id, "seq": seq, "message": "Empty isochrone result"}

            transformed_geom = transform_geometry_to_coord_type(geom, payload.coord_type)
            return {"ok": True, "sample_id": sample_id, "seq": seq, "geometry": mapping(transformed_geom)}

    sample_point_rows = []
    tasks = []
    for idx, point in enumerate(sample_points, start=1):
        sample_id = f"sample_{idx:03d}"
        sample_point_rows.append(
            {
                "id": sample_id,
                "seq": idx,
                "location": transform_point_from_wgs84(float(point[0]), float(point[1]), payload.coord_type),
            }
        )
        tasks.append(_compute_one(sample_id, idx, point))

    raw_results = await asyncio.gather(*tasks)
    feature_rows = []
    errors = []
    for item in raw_results:
        if item.get("ok"):
            feature_rows.append(
                {
                    "type": "Feature",
                    "properties": {"sample_id": item["sample_id"], "seq": item["seq"]},
                    "geometry": item["geometry"],
                }
            )
        else:
            errors.append({"sample_id": item["sample_id"], "seq": item["seq"], "message": item["message"]})

    if not feature_rows:
        raise HTTPException(502, "All debug sample isochrone requests failed")

    scope_geometry = mapping(transform_geometry_to_coord_type(clip_poly, payload.coord_type))
    return {
        "scope_geometry": scope_geometry,
        "sample_points": sample_point_rows,
        "isochrone_features": feature_rows,
        "meta": {
            "origin_count": len(sample_point_rows),
            "time_min": payload.time_min,
            "mode": payload.mode,
            "coord_type": payload.coord_type,
            "sample_boundary_step_m": payload.sample_boundary_step_m,
            "errors": errors,
        },
    }
