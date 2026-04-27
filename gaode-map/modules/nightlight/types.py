from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry.base import BaseGeometry


@dataclass(frozen=True)
class ResolvedDataset:
    year: int
    label: str
    file: str
    path: Path
    unit: str
    variable: str


@dataclass(frozen=True)
class NightlightClip:
    array: np.ma.MaskedArray | None
    transform: Any | None
    crs: Any | None = None
    width: int = 0
    height: int = 0
    nodata: float | None = None
    empty: bool = False

    @classmethod
    def empty_clip(cls) -> "NightlightClip":
        return cls(
            array=None,
            transform=None,
            crs=None,
            width=0,
            height=0,
            nodata=None,
            empty=True,
        )


@dataclass(frozen=True)
class TargetGridCell:
    cell_id: str
    row: int
    col: int
    centroid_gcj02: list[float]
    geometry_gcj02: list[list[list[float]]]
    geometry_wgs84: BaseGeometry
    feature: dict[str, Any] | None = None


@dataclass(frozen=True)
class AggregatedNightlightCell:
    cell_id: str
    row: int
    col: int
    raw_value: float
    valid_pixel_count: int
    centroid_gcj02: list[float]
    geometry_gcj02: list[list[list[float]]]
