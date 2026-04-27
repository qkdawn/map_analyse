import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from core.spatial import (
    build_scope_id,
    pick_largest_polygon,
    polygon_from_payload,
    to_wgs84_geometry,
    transform_polygon_payload_coords,
)
from modules.providers.amap.utils.transform_posi import gcj02_to_wgs84, wgs84_to_gcj02


def _sample_wgs84_ring():
    return [
        [121.462, 31.248],
        [121.498, 31.248],
        [121.498, 31.214],
        [121.462, 31.214],
        [121.462, 31.248],
    ]


def _sample_gcj02_ring():
    return [list(wgs84_to_gcj02(lng, lat)) for lng, lat in _sample_wgs84_ring()]


def test_polygon_from_payload_supports_single_ring():
    geom = polygon_from_payload(_sample_wgs84_ring())

    assert geom.geom_type == "Polygon"
    assert geom.is_valid
    assert geom.area > 0


def test_polygon_from_payload_supports_nested_polygon_payloads():
    large_ring = _sample_wgs84_ring()
    small_ring = [
        [121.470, 31.240],
        [121.478, 31.240],
        [121.478, 31.232],
        [121.470, 31.232],
        [121.470, 31.240],
    ]

    geom = polygon_from_payload([[large_ring], [small_ring]])
    largest = pick_largest_polygon(geom)

    assert geom.geom_type == "MultiPolygon"
    assert largest is not None
    assert round(largest.area, 12) == round(polygon_from_payload(large_ring).area, 12)


def test_polygon_from_payload_invalid_input_returns_empty_polygon():
    geom = polygon_from_payload([[121.462, 31.248], ["bad"], [None, None]])

    assert geom.is_empty


def test_to_wgs84_geometry_round_trip_from_gcj02_polygon():
    geom = to_wgs84_geometry(_sample_gcj02_ring(), "gcj02")
    expected = polygon_from_payload(_sample_wgs84_ring()).buffer(0)

    assert geom.geom_type == "Polygon"
    assert geom.symmetric_difference(expected).area < 1e-8


def test_transform_polygon_payload_coords_preserves_nested_shape():
    nested = [[_sample_gcj02_ring()]]

    transformed = transform_polygon_payload_coords(nested, gcj02_to_wgs84)

    assert len(transformed) == 1
    assert len(transformed[0]) == 1
    first_point = transformed[0][0][0]
    expected_first_point = _sample_wgs84_ring()[0]
    assert abs(first_point[0] - expected_first_point[0]) < 1e-5
    assert abs(first_point[1] - expected_first_point[1]) < 1e-5


def test_build_scope_id_is_stable_for_same_geometry_and_parts():
    geom = polygon_from_payload(_sample_wgs84_ring()).buffer(0)

    scope_a = build_scope_id(geom, "population", "overview")
    scope_b = build_scope_id(geom, "population", "overview")
    scope_c = build_scope_id(geom, "population", "density")

    assert scope_a == scope_b
    assert scope_a != scope_c
    assert len(scope_a) == 24
