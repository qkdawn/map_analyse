from __future__ import annotations

import math

import numpy as np
from shapely.geometry import box
from shapely.ops import transform

from .common import round_float
from .types import AggregatedNightlightCell, NightlightClip, TargetGridCell


def aggregate_clip_to_target_cells(
    clip: NightlightClip,
    target_cells: list[TargetGridCell],
) -> list[AggregatedNightlightCell]:
    if clip.empty or clip.array is None or clip.transform is None or not target_cells:
        return []

    values = np.ma.filled(clip.array, np.nan).astype(np.float64)
    mask = np.ma.getmaskarray(clip.array)
    valid = (~mask) & np.isfinite(values)
    height, width = values.shape
    inverse_transform = ~clip.transform

    rows: list[AggregatedNightlightCell] = []
    for cell in target_cells:
        pixel_count = 0
        mean_value = 0.0
        geom_wgs84 = cell.geometry_wgs84
        if not geom_wgs84.is_empty and width > 0 and height > 0:
            geom_pixel = transform(
                lambda x, y, z=None: inverse_transform * (x, y),
                geom_wgs84,
            ).buffer(0)
            if not geom_pixel.is_empty:
                minx, miny, maxx, maxy = geom_pixel.bounds
                row_start = max(0, int(math.floor(min(miny, maxy))))
                row_stop = min(height, int(math.ceil(max(miny, maxy))))
                col_start = max(0, int(math.floor(min(minx, maxx))))
                col_stop = min(width, int(math.ceil(max(minx, maxx))))
                weighted_sum = 0.0
                total_weight = 0.0
                if row_stop > row_start and col_stop > col_start:
                    for row in range(row_start, row_stop):
                        for col in range(col_start, col_stop):
                            if not bool(valid[row, col]):
                                continue
                            overlap_area = float(geom_pixel.intersection(box(col, row, col + 1, row + 1)).area)
                            if overlap_area <= 1e-9:
                                continue
                            weighted_sum += max(float(values[row, col]), 0.0) * overlap_area
                            total_weight += overlap_area
                            pixel_count += 1
                if total_weight > 1e-9:
                    mean_value = weighted_sum / total_weight
        rows.append(
            AggregatedNightlightCell(
                cell_id=cell.cell_id,
                row=cell.row,
                col=cell.col,
                raw_value=round_float(mean_value, 6),
                valid_pixel_count=pixel_count,
                centroid_gcj02=list(cell.centroid_gcj02),
                geometry_gcj02=cell.geometry_gcj02,
            )
        )
    return rows
