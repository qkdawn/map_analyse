import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from core.spatial import build_scope_id as core_build_scope_id
from core.spatial import to_wgs84_geometry as core_to_wgs84_geometry
from modules.nightlight.common import build_scope_id as nightlight_build_scope_id
from modules.nightlight.common import to_wgs84_geometry as nightlight_to_wgs84_geometry
from modules.providers.amap.utils.transform_posi import wgs84_to_gcj02


def _sample_gcj02_ring():
    ring_wgs84 = [
        [121.462, 31.248],
        [121.498, 31.248],
        [121.498, 31.214],
        [121.462, 31.214],
        [121.462, 31.248],
    ]
    return [list(wgs84_to_gcj02(lng, lat)) for lng, lat in ring_wgs84]


def test_nightlight_common_reuses_shared_spatial_contract():
    polygon = _sample_gcj02_ring()

    core_geom = core_to_wgs84_geometry(polygon, "gcj02")
    nightlight_geom = nightlight_to_wgs84_geometry(polygon, "gcj02")

    assert core_geom.symmetric_difference(nightlight_geom).area < 1e-12
    assert core_build_scope_id(core_geom, "nightlight", "summary") == nightlight_build_scope_id(
        nightlight_geom, "nightlight", "summary"
    )
