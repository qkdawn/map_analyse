import h3
import logging
from shapely.geometry import Polygon, mapping
from typing import Any, Dict, Iterable, List, Tuple, Literal
from modules.gaode_service.utils.transform_posi import gcj02_to_wgs84, wgs84_to_gcj02

logger = logging.getLogger(__name__)

IncludeMode = Literal["intersects", "inside"]


def _ensure_closed_ring(coords: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
    if not coords:
        return []
    if coords[0] == coords[-1]:
        return coords
    return coords + [coords[0]]


def _normalize_polygon(polygon: Polygon) -> Polygon:
    if polygon.is_empty:
        return polygon
    if polygon.is_valid:
        return polygon
    try:
        repaired = polygon.buffer(0)
        if isinstance(repaired, Polygon):
            return repaired
        if hasattr(repaired, "geoms"):
            polygons = [g for g in repaired.geoms if isinstance(g, Polygon)]
            if polygons:
                return max(polygons, key=lambda g: g.area)
    except Exception:
        pass
    return Polygon()


def _convert_polygon_coords(
    polygon: Polygon,
    converter
) -> Polygon:
    ext = [converter(x, y) for x, y in polygon.exterior.coords]
    holes = [[converter(x, y) for x, y in ring.coords] for ring in polygon.interiors]
    return Polygon(ext, holes)


def _coords_to_polygon(polygon_coords: List[List[float]]) -> Polygon:
    coords: List[Tuple[float, float]] = []
    for pt in polygon_coords or []:
        if not isinstance(pt, (list, tuple)) or len(pt) < 2:
            continue
        try:
            coords.append((float(pt[0]), float(pt[1])))
        except (TypeError, ValueError):
            continue

    coords = _ensure_closed_ring(coords)
    if len(coords) < 4:
        return Polygon()
    return _normalize_polygon(Polygon(coords))


def polygon_to_hexagons(
    polygon: Polygon,
    resolution: int = 9,
    coord_type: Literal["gcj02", "wgs84"] = "gcj02"
) -> List[str]:
    """
    Convert a Shapely Polygon to a list of H3 hexagon indices.
    
    Args:
        polygon: Shapely Polygon (GCJ02 by default).
        resolution: H3 resolution (0-15).
                    Res 9 ~ 0.1km^2 edge length ~174m
                    Res 8 ~ 0.7km^2 edge length ~461m
        coord_type: Input coordinate system. "gcj02" or "wgs84".
        
    Returns:
        List of H3 indices (strings).
    """
    if not isinstance(polygon, Polygon) or polygon.is_empty:
        return []

    # h3-py v4 API: polygon_to_cells (formerly polyfill)
    # Input format: GeoJSON-like dictionary. 
    # Important: h3 expects (lat, lng) or GeoJSON (lng, lat).
    # h3.polygon_to_cells(geojson, res) checks for GeoJSON compliance.
    
    # h3.polygon_to_cells(geojson, res) checks for GeoJSON compliance.
    
    # 1. Ensure polygon is WGS84 for H3
    if coord_type == "gcj02":
        temp_poly = _convert_polygon_coords(polygon, gcj02_to_wgs84)
    else:
        temp_poly = polygon
    temp_poly = _normalize_polygon(temp_poly)
    if temp_poly.is_empty:
        return []
    geo_json = mapping(temp_poly)
    
    # Handle the fact that mapping() returns {'type': 'Polygon', 'coordinates': (((lng, lat), ...),)}
    # h3.polygon_to_cells expects the geometry dict or similar.
    
    try:
        # h3 >= 4.0.0
        cells = h3.geo_to_cells(geo_json, resolution)
    except AttributeError:
        # Fallback for older versions if needed, but we installed latest.
        # Check if user has h3-py < 4.0
        try: 
             cells = h3.polyfill(geo_json, resolution, geo_json_conformant=True)
        except:
             # Manual fallback if geojson helper fails
             # Coordinates need to be valid
             return []

    return list(cells)

def get_hexagon_boundary(
    h3_index: str,
    coord_type: Literal["gcj02", "wgs84"] = "gcj02"
) -> List[Tuple[float, float]]:
    """
    Get the boundary coordinates of an H3 hexagon.
    
    Returns:
        List of (lng, lat) tuples.
        coord_type determines whether output is GCJ02 or WGS84.
    """
    try:
        # h3 v4: cell_to_boundary(..., geo_json=True) -> ((lng, lat), ...)
        # h3 v3: h3_to_geo_boundary(..., geo_json=True) -> ((lng, lat), ...)
        if hasattr(h3, "cell_to_boundary"):
            try:
                boundary = h3.cell_to_boundary(h3_index, geo_json=True)
            except TypeError:
                boundary = h3.cell_to_boundary(h3_index)
        elif hasattr(h3, "h3_to_geo_boundary"):
            try:
                boundary = h3.h3_to_geo_boundary(h3_index, geo_json=True)
            except TypeError:
                boundary = h3.h3_to_geo_boundary(h3_index)
        else:
            raise AttributeError("No H3 boundary function available")

        # Defensive: if order is (lat, lng), swap based on value range.
        normalized = []
        for lng, lat in boundary:
            if abs(lng) <= 90 and abs(lat) > 90:
                lng, lat = lat, lng
            normalized.append((lng, lat))

        if coord_type == "wgs84":
            return normalized

        # Boundary is WGS84, convert back to GCJ02 for AMap
        gcj02_boundary = []
        for lng, lat in normalized:
            gx, gy = wgs84_to_gcj02(lng, lat)
            gcj02_boundary.append((gx, gy))

        return gcj02_boundary
    except Exception as e:
        logger.warning("H3 boundary failed for %s: %s", h3_index, e)
        return []

def get_hexagon_children(h3_index: str) -> List[str]:
    """
    Get children of a hexagon (1 resolution finer).
    """
    try:
        # h3 v4
        if hasattr(h3, "cell_to_children"):
            return list(h3.cell_to_children(h3_index))
        # h3 v3
        elif hasattr(h3, "h3_to_children"):
            return list(h3.h3_to_children(h3_index))
        else:
            return []
    except Exception as e:
        logger.warning("H3 children failed for %s: %s", h3_index, e)
        return []


def _expand_hexagons_with_neighbors(hexagons: Iterable[str], ring_size: int = 1) -> List[str]:
    expanded = set(hexagons or [])
    if ring_size <= 0:
        return list(expanded)

    for h3_index in list(expanded):
        try:
            if hasattr(h3, "grid_disk"):
                expanded.update(h3.grid_disk(h3_index, ring_size))
            elif hasattr(h3, "k_ring"):
                expanded.update(h3.k_ring(h3_index, ring_size))
        except Exception as e:
            logger.debug("Neighbor expand failed for %s: %s", h3_index, e)
    return list(expanded)


def hexagons_to_geojson_features(
    hexagons: Iterable[str],
    resolution: int,
    source_polygon_wgs84: Polygon,
    include_mode: IncludeMode = "intersects",
    min_overlap_ratio: float = 0.0,
    output_coord_type: Literal["gcj02", "wgs84"] = "gcj02",
) -> List[Dict[str, Any]]:
    """
    Convert H3 indices to GeoJSON Polygon features.
    """
    features: List[Dict[str, Any]] = []
    normalized_source = _normalize_polygon(source_polygon_wgs84)
    if normalized_source.is_empty:
        return features

    for h3_index in sorted(set(hexagons)):
        boundary_wgs84 = get_hexagon_boundary(h3_index, coord_type="wgs84")
        if len(boundary_wgs84) < 3:
            continue

        boundary_wgs84 = _ensure_closed_ring(boundary_wgs84)
        cell_polygon = _normalize_polygon(Polygon(boundary_wgs84))
        if cell_polygon.is_empty:
            continue

        overlap_ratio = 0.0
        if include_mode == "inside":
            keep = normalized_source.covers(cell_polygon)
        else:
            keep = normalized_source.intersects(cell_polygon)
            if keep:
                try:
                    inter_area = normalized_source.intersection(cell_polygon).area
                    cell_area = cell_polygon.area
                    overlap_ratio = (inter_area / cell_area) if cell_area > 0 else 0.0
                except Exception:
                    overlap_ratio = 0.0
                keep = overlap_ratio >= min_overlap_ratio
        if not keep:
            continue

        if output_coord_type == "gcj02":
            output_ring = [wgs84_to_gcj02(lng, lat) for lng, lat in boundary_wgs84]
            output_ring = _ensure_closed_ring(output_ring)
        else:
            output_ring = boundary_wgs84

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "h3_id": h3_index,
                    "resolution": resolution,
                    "include_mode": include_mode,
                    "overlap_ratio": overlap_ratio,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [output_ring],
                },
            }
        )

    return features


def build_h3_grid_feature_collection(
    polygon_coords: List[List[float]],
    resolution: int = 9,
    coord_type: Literal["gcj02", "wgs84"] = "gcj02",
    include_mode: IncludeMode = "intersects",
    min_overlap_ratio: float = 0.0,
) -> Dict[str, Any]:
    """
    Build H3 grid GeoJSON FeatureCollection from a polygon ring.
    """
    input_polygon = _coords_to_polygon(polygon_coords)
    if input_polygon.is_empty:
        return {"type": "FeatureCollection", "features": [], "count": 0}

    if coord_type == "gcj02":
        source_polygon_wgs84 = _normalize_polygon(_convert_polygon_coords(input_polygon, gcj02_to_wgs84))
    else:
        source_polygon_wgs84 = input_polygon

    if source_polygon_wgs84.is_empty:
        return {"type": "FeatureCollection", "features": [], "count": 0}

    # For intersects mode, polygon_to_cells may miss edge cells because it uses
    # center-in-polygon semantics. Build a broader candidate set from bbox first,
    # then clip by geometric intersection.
    if include_mode == "intersects":
        candidate_polygon = _normalize_polygon(source_polygon_wgs84.envelope)
        if candidate_polygon.is_empty:
            candidate_polygon = source_polygon_wgs84
    else:
        candidate_polygon = source_polygon_wgs84

    seed_hexagons = polygon_to_hexagons(candidate_polygon, resolution=resolution, coord_type="wgs84")
    if include_mode == "intersects":
        hexagons = _expand_hexagons_with_neighbors(seed_hexagons, ring_size=1)
    else:
        hexagons = seed_hexagons

    features = hexagons_to_geojson_features(
        hexagons=hexagons,
        resolution=resolution,
        source_polygon_wgs84=source_polygon_wgs84,
        include_mode=include_mode,
        min_overlap_ratio=max(0.0, min(1.0, float(min_overlap_ratio or 0.0))),
        output_coord_type="gcj02",
    )

    return {
        "type": "FeatureCollection",
        "features": features,
        "count": len(features),
    }
