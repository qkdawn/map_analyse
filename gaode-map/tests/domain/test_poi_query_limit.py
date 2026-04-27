import math

from modules.poi.core import (
    AMAP_POLYGON_MAX_QUERY_LEN,
    _estimate_amap_polygon_query_len,
    _fit_polygon_to_query_limit,
    _split_type_codes,
    _split_types_by_query_limit,
)


def _build_dense_polygon(vertex_count: int = 200):
    center_lng, center_lat = 112.9388, 28.2282
    radius = 0.03
    points = []
    for index in range(vertex_count):
        angle = 2 * math.pi * index / vertex_count
        points.append([center_lng + radius * math.cos(angle), center_lat + radius * math.sin(angle)])
    points.append(points[0])
    return points


def _build_type_codes(count: int = 65) -> str:
    return "|".join(f"{50000 + index:06d}" for index in range(count))


def test_fit_polygon_to_query_limit_reduces_query_len():
    polygon = _build_dense_polygon()
    types = _build_type_codes()

    raw_len = _estimate_amap_polygon_query_len(polygon, "", types, "dummy_key")
    fitted_polygon = _fit_polygon_to_query_limit(polygon, "", types, "dummy_key")
    fitted_len = _estimate_amap_polygon_query_len(fitted_polygon, "", types, "dummy_key")

    assert raw_len > AMAP_POLYGON_MAX_QUERY_LEN
    assert fitted_len <= AMAP_POLYGON_MAX_QUERY_LEN
    assert len(fitted_polygon) < len(polygon)


def test_split_types_by_query_limit_keeps_all_codes_and_within_limit():
    polygon = _build_dense_polygon()
    types = _build_type_codes()
    fitted_polygon = _fit_polygon_to_query_limit(polygon, "", types, "dummy_key")

    batches = _split_types_by_query_limit(fitted_polygon, "", types, "dummy_key")
    merged_codes = []
    for batch in batches:
        if batch:
            merged_codes.extend(batch.split("|"))
        query_len = _estimate_amap_polygon_query_len(fitted_polygon, "", batch, "dummy_key")
        assert query_len <= AMAP_POLYGON_MAX_QUERY_LEN

    assert merged_codes == _split_type_codes(types)


def test_split_types_by_query_limit_returns_empty_batch_for_no_types():
    polygon = _build_dense_polygon(40)
    batches = _split_types_by_query_limit(polygon, "", "", "dummy_key")
    assert batches == [""]
