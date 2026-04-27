from core.spatial import transform_geojson_coordinates, transform_nested_coords


def test_transform_nested_coords_converts_deep_coordinate_lists():
    payload = [[100.0, 20.0], [[101.0, 21.0], [102.0, 22.0]]]
    result = transform_nested_coords(payload, lambda x, y: (x + 0.5, y + 1.0))

    assert result[0] == [100.5, 21.0]
    assert result[1][1] == [102.5, 23.0]


def test_transform_geojson_coordinates_only_rewrites_coordinate_fields():
    payload = {
        "type": "Feature",
        "properties": {"name": "demo"},
        "geometry": {"type": "Point", "coordinates": [100.0, 20.0]},
    }

    result = transform_geojson_coordinates(payload, lambda x, y: (x - 0.1, y - 0.2))

    assert result["properties"]["name"] == "demo"
    assert result["geometry"]["coordinates"] == [99.9, 19.8]
