from __future__ import annotations

import math
from typing import Any, List, Literal, Optional, Tuple

from shapely.geometry import GeometryCollection, LineString, MultiLineString, MultiPolygon, Polygon

from modules.providers.amap.utils.transform_posi import gcj02_to_wgs84


def safe_round(value: float, digits: int = 6) -> float:
    if not math.isfinite(float(value)):
        return 0.0
    return round(float(value), digits)


def safe_float(value: Any, digits: Optional[int] = None) -> Optional[float]:
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(num):
        return None
    if digits is None:
        return num
    return round(num, int(digits))


def ensure_closed_ring(coords: List[List[float]]) -> List[List[float]]:
    if not coords:
        return []
    if coords[0] == coords[-1]:
        return coords
    return coords + [coords[0]]


def coords_to_wgs84_polygon(
    polygon: list,
    coord_type: Literal["gcj02", "wgs84"],
) -> Polygon | MultiPolygon:
    def _is_coord_pair(value: Any) -> bool:
        return (
            isinstance(value, (list, tuple))
            and len(value) >= 2
            and isinstance(value[0], (int, float))
            and isinstance(value[1], (int, float))
        )

    def _normalize_poly(raw_ring: list) -> Polygon | None:
        ring: List[List[float]] = []
        for pt in raw_ring or []:
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
        ring = ensure_closed_ring(ring)
        if len(ring) < 4:
            return None
        poly = Polygon(ring)
        if not poly.is_valid:
            poly = poly.buffer(0)
        if isinstance(poly, Polygon) and not poly.is_empty:
            return poly
        if isinstance(poly, MultiPolygon):
            geoms = [g for g in poly.geoms if isinstance(g, Polygon) and not g.is_empty]
            if geoms:
                return max(geoms, key=lambda g: g.area)
        return None

    if not isinstance(polygon, list) or not polygon:
        return Polygon()

    if _is_coord_pair(polygon[0]):
        return _normalize_poly(polygon) or Polygon()

    polygons: List[Polygon] = []
    for item in polygon:
        ring_source = None
        if isinstance(item, list) and item and _is_coord_pair(item[0]):
            ring_source = item
        elif isinstance(item, list) and item and isinstance(item[0], list) and item[0] and _is_coord_pair(item[0][0]):
            ring_source = item[0]
        if ring_source is None:
            continue
        poly = _normalize_poly(ring_source)
        if poly is not None:
            polygons.append(poly)
    if not polygons:
        return Polygon()
    if len(polygons) == 1:
        return polygons[0]
    return MultiPolygon(polygons)


def haversine_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(1e-12, 1.0 - a)))
    return r * c


def collect_linestring_geoms(geom: Any, out: List[LineString]) -> None:
    if geom is None:
        return
    if isinstance(geom, LineString):
        if len(list(geom.coords)) >= 2:
            out.append(geom)
        return
    if isinstance(geom, MultiLineString):
        for part in geom.geoms:
            collect_linestring_geoms(part, out)
        return
    if isinstance(geom, GeometryCollection):
        for part in geom.geoms:
            collect_linestring_geoms(part, out)


def clip_line_to_polygon_segment(
    line: LineString,
    polygon: Polygon | MultiPolygon,
) -> Optional[Tuple[float, float, float, float]]:
    if line.is_empty or polygon.is_empty:
        return None
    try:
        clipped = line.intersection(polygon)
    except Exception:
        return None
    if clipped.is_empty:
        return None
    parts: List[LineString] = []
    collect_linestring_geoms(clipped, parts)
    if not parts:
        return None
    best = max(parts, key=lambda g: float(g.length))
    coords = list(best.coords or [])
    if len(coords) < 2:
        return None
    first = coords[0]
    last = coords[-1]
    try:
        x1 = float(first[0])
        y1 = float(first[1])
        x2 = float(last[0])
        y2 = float(last[1])
    except (TypeError, ValueError):
        return None
    if not (math.isfinite(x1) and math.isfinite(y1) and math.isfinite(x2) and math.isfinite(y2)):
        return None
    if abs(x1 - x2) <= 1e-12 and abs(y1 - y2) <= 1e-12:
        return None
    return (x1, y1, x2, y2)
