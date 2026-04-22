import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from modules.gwr import service as gwr_service


def _feature(cell_id, west, south, east, north):
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[west, north], [east, north], [east, south], [west, south], [west, north]]],
        },
        "properties": {
            "cell_id": cell_id,
            "h3_id": cell_id,
            "row": 0,
            "col": 0,
            "centroid_gcj02": [(west + east) / 2, (south + north) / 2],
        },
    }


def _grid_features(count=12):
    features = []
    for idx in range(count):
        x = float(idx) * 0.01
        features.append(_feature(f"c{idx}", x, 0.0, x + 0.008, 0.008))
    return features


def test_gwr_aggregates_poi_population_nightlight_and_road(monkeypatch):
    features = _grid_features(12)

    monkeypatch.setattr(
        gwr_service,
        "get_population_grid",
        lambda *args, **kwargs: {"scope_id": "pop-scope", "cell_count": len(features), "features": features},
    )
    monkeypatch.setattr(
        gwr_service,
        "get_population_layer",
        lambda *args, **kwargs: {
            "cells": [{"cell_id": f"c{idx}", "value": 100 + idx} for idx in range(12)]
        },
    )
    monkeypatch.setattr(
        gwr_service,
        "get_nightlight_layer",
        lambda *args, **kwargs: {
            "cells": [{"cell_id": f"c{idx}", "value": 10 + idx} for idx in range(12)]
        },
    )

    def fake_arcgis(rows, variables, **kwargs):
        assert len(rows) == 12
        first = rows[0]
        assert first["predictors"]["poi_density_per_km2"] > 0
        assert first["predictors"]["population_density"] == 100
        assert first["predictors"]["road_integration"] > 0
        assert first["predictors"]["road_connectivity"] > 0
        return {
            "ok": True,
            "summary": {"r2": 0.75, "status": "ok"},
            "cells": [
                {
                    "cell_id": row["cell_id"],
                    "observed": row["nightlight_radiance"],
                    "predicted": row["nightlight_radiance"],
                    "residual": 0,
                    "local_r2": 0.8,
                    "coefficients": {item["key"]: 0.1 for item in variables},
                }
                for row in rows
            ],
        }

    monkeypatch.setattr(gwr_service, "run_arcgis_gwr_analysis", fake_arcgis)
    result = gwr_service.analyze_nightlight_gwr(
        polygon=[],
        pois=[{"lng": 0.004, "lat": 0.004}],
        road_features=[
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[0.0, 0.004], [0.02, 0.004]]},
                "properties": {"integration_score": 0.6, "connectivity_score": 0.4},
            }
        ],
    )
    assert result["summary"]["ok"] is True
    assert result["summary"]["engine"] == "arcgis"
    assert result["feature_collection"]["count"] == 12


def test_gwr_returns_displayable_status_when_arcgis_unavailable(monkeypatch):
    features = _grid_features(12)
    monkeypatch.setattr(
        gwr_service,
        "get_population_grid",
        lambda *args, **kwargs: {"scope_id": "pop-scope", "cell_count": len(features), "features": features},
    )
    monkeypatch.setattr(
        gwr_service,
        "get_population_layer",
        lambda *args, **kwargs: {"cells": [{"cell_id": f"c{idx}", "value": 100 + idx} for idx in range(12)]},
    )
    monkeypatch.setattr(
        gwr_service,
        "get_nightlight_layer",
        lambda *args, **kwargs: {"cells": [{"cell_id": f"c{idx}", "value": 10 + idx} for idx in range(12)]},
    )

    def fail_arcgis(**kwargs):
        raise gwr_service.ArcGISGwrBridgeError("not configured")

    monkeypatch.setattr(gwr_service, "run_arcgis_gwr_analysis", fail_arcgis)
    result = gwr_service.analyze_nightlight_gwr(
        polygon=[],
        pois=[{"lng": 0.004, "lat": 0.004}],
        road_features=[
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[0.0, 0.004], [0.02, 0.004]]},
                "properties": {"integration_score": 0.6, "connectivity_score": 0.4},
            }
        ],
    )
    assert result["summary"]["ok"] is False
    assert "ArcGIS GWR 不可用" in result["summary"]["status"]


def test_gwr_sample_count_guard(monkeypatch):
    features = _grid_features(6)
    monkeypatch.setattr(
        gwr_service,
        "get_population_grid",
        lambda *args, **kwargs: {"scope_id": "pop-scope", "cell_count": len(features), "features": features},
    )
    monkeypatch.setattr(
        gwr_service,
        "get_population_layer",
        lambda *args, **kwargs: {"cells": [{"cell_id": f"c{idx}", "value": 100 + idx} for idx in range(6)]},
    )
    monkeypatch.setattr(
        gwr_service,
        "get_nightlight_layer",
        lambda *args, **kwargs: {"cells": [{"cell_id": f"c{idx}", "value": 10 + idx} for idx in range(6)]},
    )
    result = gwr_service.analyze_nightlight_gwr(
        polygon=[],
        pois=[{"lng": 0.004, "lat": 0.004}],
        road_features=[
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [[0.0, 0.004], [0.02, 0.004]]},
                "properties": {"integration_score": 0.6, "connectivity_score": 0.4},
            }
        ],
    )
    assert result["summary"]["ok"] is False
    assert "有效样本不足" in result["summary"]["status"]
