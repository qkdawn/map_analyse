from __future__ import annotations

from pathlib import Path
from typing import Any

from core.spatial import (
    build_scope_id,
    convert_geometry,
    normalize_ring,
    polygon_from_payload,
    round_float,
    to_wgs84_geometry,
)

RADIANCE_VIEW = "radiance"
RADIANCE_VIEW_LABEL = "夜光辐亮"
HOTSPOT_VIEW = "hotspot"
HOTSPOT_VIEW_LABEL = "热点分级"
GRADIENT_VIEW = "gradient"
GRADIENT_VIEW_LABEL = "梯度衰减"
RADIANCE_UNIT = "nWatts/(cm^2 sr)"
PREVIEW_STYLE_VERSION = "v1"
GRID_STYLE_VERSION = "v2"
MANIFEST_FILENAME = "manifest.json"
DEFAULT_VARIABLE_NAME = "NearNadir_Composite_Snow_Free"
PREVIEW_PALETTE = [
    (0, 0, 0),
    (46, 20, 0),
    (120, 56, 0),
    (224, 124, 0),
    (255, 214, 64),
    (255, 255, 255),
]


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_dir(path_value: str) -> Path:
    path = Path(path_value).expanduser()
    if not path.is_absolute():
        path = project_root() / path
    return path.resolve()
def year_label(year: int) -> str:
    return f"{int(year)} 年"
