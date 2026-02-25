import sys
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from shapely.geometry import Polygon

from modules.grid_h3.core import build_h3_grid_feature_collection
from modules.gaode_service.utils.transform_posi import wgs84_to_gcj02


def _sample_wgs84_polygon():
    lat = 31.2304
    lon = 121.4737
    d = 0.01
    return [
        [lon - d, lat - d],
        [lon + d, lat - d],
        [lon + d, lat + d],
        [lon - d, lat + d],
        [lon - d, lat - d],
    ]


def _sample_gcj02_polygon():
    return [list(wgs84_to_gcj02(x, y)) for x, y in _sample_wgs84_polygon()]


def test_grid_feature_collection_non_empty():
    fc = build_h3_grid_feature_collection(_sample_gcj02_polygon(), resolution=9, coord_type="gcj02")
    assert fc["type"] == "FeatureCollection"
    assert fc["count"] > 0
    assert len(fc["features"]) == fc["count"]


def test_grid_features_have_valid_shape_and_properties():
    fc = build_h3_grid_feature_collection(_sample_gcj02_polygon(), resolution=9, coord_type="gcj02")
    assert fc["count"] > 0

    for feat in fc["features"]:
        assert feat["type"] == "Feature"
        assert feat["properties"]["h3_id"]
        assert feat["properties"]["resolution"] == 9

        geometry = feat["geometry"]
        assert geometry["type"] == "Polygon"
        ring = geometry["coordinates"][0]
        assert len(ring) >= 4

        poly = Polygon(ring)
        assert not poly.is_empty
        assert poly.is_valid


def test_inside_mode_not_more_than_intersects():
    intersects_fc = build_h3_grid_feature_collection(
        _sample_gcj02_polygon(),
        resolution=9,
        coord_type="gcj02",
        include_mode="intersects",
    )
    inside_fc = build_h3_grid_feature_collection(
        _sample_gcj02_polygon(),
        resolution=9,
        coord_type="gcj02",
        include_mode="inside",
    )
    assert inside_fc["count"] <= intersects_fc["count"]


def test_higher_overlap_ratio_reduces_or_equals_count():
    loose_fc = build_h3_grid_feature_collection(
        _sample_gcj02_polygon(),
        resolution=10,
        coord_type="gcj02",
        include_mode="intersects",
        min_overlap_ratio=0.0,
    )
    strict_fc = build_h3_grid_feature_collection(
        _sample_gcj02_polygon(),
        resolution=10,
        coord_type="gcj02",
        include_mode="intersects",
        min_overlap_ratio=0.4,
    )
    assert strict_fc["count"] <= loose_fc["count"]


def test_wgs84_input_supported():
    fc = build_h3_grid_feature_collection(_sample_wgs84_polygon(), resolution=9, coord_type="wgs84")
    assert fc["type"] == "FeatureCollection"
    assert fc["count"] > 0


if __name__ == "__main__":
    test_grid_feature_collection_non_empty()
    test_grid_features_have_valid_shape_and_properties()
    test_inside_mode_not_more_than_intersects()
    test_higher_overlap_ratio_reduces_or_equals_count()
    test_wgs84_input_supported()
    print("H3 core tests passed.")
