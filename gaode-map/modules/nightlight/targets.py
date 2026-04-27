from __future__ import annotations

from shapely.geometry import shape

from modules.population.service import get_population_grid
from modules.providers.amap.utils.transform_posi import gcj02_to_wgs84

from .common import convert_geometry
from .types import TargetGridCell


def load_target_cells(polygon: list, coord_type: str) -> list[TargetGridCell]:
    payload = get_population_grid(polygon, coord_type)
    cells: list[TargetGridCell] = []
    for raw_feature in payload.get("features") or []:
        if not isinstance(raw_feature, dict):
            continue
        geometry = raw_feature.get("geometry") or {}
        if str(geometry.get("type") or "") != "Polygon":
            continue
        props = raw_feature.get("properties") or {}
        cell_id = str(props.get("cell_id") or "").strip()
        if not cell_id:
            continue
        try:
            geom_gcj02 = shape(geometry)
        except Exception:
            continue
        if geom_gcj02.is_empty:
            continue
        geom_wgs84 = convert_geometry(geom_gcj02, gcj02_to_wgs84).buffer(0)
        if geom_wgs84.is_empty:
            continue
        cells.append(
            TargetGridCell(
                cell_id=cell_id,
                row=int(props.get("row", -1)),
                col=int(props.get("col", -1)),
                centroid_gcj02=list(props.get("centroid_gcj02") or []),
                geometry_gcj02=(geometry.get("coordinates") or []),
                geometry_wgs84=geom_wgs84,
                feature=raw_feature,
            )
        )
    return cells
