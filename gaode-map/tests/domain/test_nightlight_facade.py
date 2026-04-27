import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
sys.path.append(str(Path(__file__).resolve().parents[1]))

from modules.nightlight import service as nightlight_service  # noqa: E402
from modules.nightlight.types import AggregatedNightlightCell, TargetGridCell  # noqa: E402
from nightlight_test_utils import configure_nightlight_dir, sample_gcj02_polygon  # noqa: E402


def test_get_nightlight_layer_orchestrates_target_loading_and_aggregation(monkeypatch, tmp_path):
    configure_nightlight_dir(tmp_path, year=2025)
    polygon = sample_gcj02_polygon()
    calls = {"load": 0, "aggregate": 0}

    target_cell = TargetGridCell(
        cell_id="cell_a",
        row=0,
        col=0,
        centroid_gcj02=[121.47, 31.24],
        geometry_gcj02=[[[121.46, 31.25], [121.48, 31.25], [121.48, 31.23], [121.46, 31.23], [121.46, 31.25]]],
        geometry_wgs84=nightlight_service.to_wgs84_geometry(polygon, "gcj02"),
        feature={
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[121.46, 31.25], [121.48, 31.25], [121.48, 31.23], [121.46, 31.23], [121.46, 31.25]]],
            },
            "properties": {
                "cell_id": "cell_a",
                "row": 0,
                "col": 0,
                "centroid_gcj02": [121.47, 31.24],
            },
        },
    )

    def fake_load_target_cells(arg_polygon, arg_coord_type):
        assert arg_polygon == polygon
        assert arg_coord_type == "gcj02"
        calls["load"] += 1
        return [target_cell]

    def fake_aggregate(clip, target_cells):
        assert clip.empty is False
        assert target_cells == [target_cell]
        calls["aggregate"] += 1
        return [
            AggregatedNightlightCell(
                cell_id="cell_a",
                row=0,
                col=0,
                raw_value=9.5,
                valid_pixel_count=2,
                centroid_gcj02=[121.47, 31.24],
                geometry_gcj02=target_cell.geometry_gcj02,
            )
        ]

    monkeypatch.setattr(nightlight_service, "load_target_cells", fake_load_target_cells)
    monkeypatch.setattr(nightlight_service, "aggregate_clip_to_target_cells", fake_aggregate)

    layer = nightlight_service.get_nightlight_layer(polygon, "gcj02", year=2025)

    assert calls == {"load": 1, "aggregate": 1}
    assert len(layer["cells"]) == 1
    assert layer["cells"][0]["cell_id"] == "cell_a"
    assert float(layer["cells"][0]["value"]) == 9.5
