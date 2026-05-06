from modules.spatial_factor_engine import (
    build_spatial_consistency_factor,
    build_spatial_factors,
    build_subcategory_spatial_snapshot,
    build_subcategory_spatial_trends,
)


def test_point_spatial_factors_classify_direction_and_rings():
    points = [
        {"lng": 112.00, "lat": 28.00, "subcategory": "咖啡厅"},
        {"lng": 112.01, "lat": 28.01, "subcategory": "咖啡厅"},
        {"lng": 112.02, "lat": 28.02, "subcategory": "咖啡厅"},
        {"lng": 112.03, "lat": 28.03, "subcategory": "咖啡厅"},
    ]

    result = build_spatial_factors(points, mode="point", center=[112.0, 28.0])

    assert result["point_count"] == 4
    assert result["direction_factor"]["dominant_direction"] == "东北"
    assert result["ring_factor"]["dominant_ring"] in {"核心圈层", "中圈层", "外围圈层"}
    assert result["ring_factor"]["max_distance_m"] > 0
    assert result["road_proximity_factor"]["road_feature_count"] == 0


def test_subcategory_spatial_trends_report_centroid_shift_and_hotspots():
    summaries = [
        {
            "year": 2023,
            "subcategory_counts": {"咖啡厅": 2},
            "top_subcategories": [{"name": "咖啡厅", "parent": "餐饮"}],
            "points": [
                {"lng": 112.00, "lat": 28.00, "subcategory": "咖啡厅", "category": "餐饮", "area": "一区"},
                {"lng": 112.001, "lat": 28.001, "subcategory": "咖啡厅", "category": "餐饮", "area": "一区"},
            ],
        },
        {
            "year": 2025,
            "subcategory_counts": {"咖啡厅": 4},
            "top_subcategories": [{"name": "咖啡厅", "parent": "餐饮"}],
            "points": [
                {"lng": 112.03, "lat": 28.03, "subcategory": "咖啡厅", "category": "餐饮", "area": "二区"},
                {"lng": 112.031, "lat": 28.031, "subcategory": "咖啡厅", "category": "餐饮", "area": "二区"},
                {"lng": 112.032, "lat": 28.032, "subcategory": "咖啡厅", "category": "餐饮", "area": "二区"},
                {"lng": 112.033, "lat": 28.033, "subcategory": "咖啡厅", "category": "餐饮", "area": "二区"},
            ],
        },
    ]

    result = build_subcategory_spatial_trends(summaries, center=[112.0, 28.0])
    row = result["subcategory_spatial_trend_rows"][0]

    assert result["spatial_factors"]["geometry_mode"] == "point"
    assert row["name"] == "咖啡厅"
    assert row["delta"] == 2
    assert row["dominant_direction"] == "东北"
    assert row["centroid_shift_direction"] == "东北"
    assert row["centroid_shift_m"] > 0
    assert row["hotspot_grid_count"] >= 1
    assert row["top_area"] == "二区"
    assert result["subcategory_spatial_summary"]


def test_grid_spatial_factors_use_value_weighted_direction():
    cells = [
        {"cell_id": "east", "centroid_gcj02": [112.02, 28.0], "raw_value": 30.0},
        {"cell_id": "north", "centroid_gcj02": [112.0, 28.02], "raw_value": 10.0},
        {"cell_id": "west", "centroid_gcj02": [111.98, 28.0], "raw_value": 5.0},
    ]

    result = build_spatial_factors(cells, mode="grid", center=[112.0, 28.0], value_key="raw_value")

    assert result["geometry_mode"] == "grid"
    assert result["direction_factor"]["dominant_direction"] == "东"
    assert result["hotspot_factor"]["hotspot_grid_count"] >= 1
    assert result["centroid_factor"]["direction_from_center"] == "东"


def test_line_spatial_factors_report_length_weighted_orientation():
    features = [
        {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[0.0, 0.0], [2.0, 0.0]]}},
        {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[0.0, 0.0], [0.0, 0.5]]}},
        {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[0.0, 0.0], [0.5, 0.5]]}},
    ]

    result = build_spatial_factors(features, mode="line")
    orientation = result["orientation_factor"]

    assert result["geometry_mode"] == "line"
    assert orientation["dominant_orientation"] == "东西向"
    assert float(orientation["dominant_share"]) > 0.5


def test_site_spatial_factors_report_proximity_metrics():
    result = build_spatial_factors(
        [{"lng": 112.0, "lat": 28.0}],
        mode="site",
        center=[112.0, 28.0],
        options={
            "hotspots": [{"lng": 112.001, "lat": 28.0}],
            "nearby_pois": [
                {"lng": 112.001, "lat": 28.0, "category": "餐饮"},
                {"lng": 112.002, "lat": 28.0, "category": "购物"},
            ],
            "competitors": [{"lng": 112.001, "lat": 28.0, "category": "餐饮"}],
            "poi_mix_radius_m": 300,
        },
    )
    proximity = result["proximity_factor"]

    assert result["geometry_mode"] == "site"
    assert proximity["center_distance_m"] == 0.0
    assert proximity["nearest_hotspot_distance_m"] > 0
    assert proximity["nearby_poi_count"] == 2
    assert proximity["nearby_category_count"] == 2
    assert proximity["nearby_competitor_count"] == 1


def test_spatial_consistency_factor_classifies_alignment_levels():
    nightlight = build_spatial_factors(
        [{"centroid_gcj02": [1.0, 0.0], "raw_value": 10}],
        mode="grid",
        center=[0.0, 0.0],
        value_key="raw_value",
    )
    road = build_spatial_factors(
        [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[0.0, 0.0], [2.0, 0.0]]}}],
        mode="line",
    )
    mismatch_road = build_spatial_factors(
        [{"type": "Feature", "geometry": {"type": "LineString", "coordinates": [[0.0, 0.0], [0.0, 2.0]]}}],
        mode="line",
    )

    assert build_spatial_consistency_factor(nightlight, road)["alignment_level"] == "high"
    assert build_spatial_consistency_factor(nightlight, mismatch_road)["alignment_level"] == "low"
    assert build_spatial_consistency_factor({}, {})["alignment_level"] == "unknown"


def test_polygon_spatial_factors_report_area_and_centroid():
    polygon = {
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[112.0, 28.0], [112.02, 28.0], [112.02, 28.02], [112.0, 28.02], [112.0, 28.0]]],
        }
    }

    result = build_spatial_factors([polygon], mode="polygon", center=[112.0, 28.0])

    assert result["geometry_mode"] == "polygon"
    assert result["polygon_factor"]["polygon_count"] == 1
    assert result["polygon_factor"]["total_area_score"] > 0
    assert result["centroid_factor"]["distance_from_center_m"] > 0


def test_subcategory_spatial_snapshot_reports_stable_rows_without_place_inference():
    points = [
        {"lng": 112.01, "lat": 28.01, "subcategory": "咖啡厅", "category": "餐饮", "area": "一区"},
        {"lng": 112.011, "lat": 28.011, "subcategory": "咖啡厅", "category": "餐饮", "area": "一区"},
        {"lng": 111.99, "lat": 27.99, "subcategory": "商场", "category": "购物", "area": "二区"},
    ]

    result = build_subcategory_spatial_snapshot(points, center=[112.0, 28.0])
    row = result["subcategory_spatial_rows"][0]

    assert row["name"] == "咖啡厅"
    assert row["parent"] == "餐饮"
    assert row["count"] == 2
    assert row["share"] > 0
    assert row["dominant_direction"] == "东北"
    assert row["dominant_ring"]
    assert row["hotspot_grid_count"] >= 1
    assert row["top_area"] == "一区"
    assert result["subcategory_spatial_summary"]
    assert "112." not in result["subcategory_spatial_summary"][0]
