import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[2]))
os.environ.setdefault("AMAP_JS_API_KEY", "test-key")

import router.domains.gwr as gwr_router_module
from main import app


def test_gwr_api_returns_analysis_payload(monkeypatch):
    client = TestClient(app)

    def fake_analyze_nightlight_gwr(**kwargs):
        assert kwargs["population_year"] == "2026"
        assert kwargs["nightlight_year"] == 2025
        return {
            "summary": {"ok": True, "status": "ok", "engine": "arcgis", "sample_count": 12, "cell_count": 12, "variable_count": 5},
            "variables": [],
            "cells": [],
            "feature_collection": {"type": "FeatureCollection", "features": [], "count": 0},
            "diagnostics": {},
            "engine_status": "ArcGIS GWR",
        }

    monkeypatch.setattr(gwr_router_module, "analyze_nightlight_gwr", fake_analyze_nightlight_gwr)
    resp = client.post(
        "/api/v1/analysis/gwr",
        json={
            "polygon": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            "coord_type": "gcj02",
            "population_year": "2026",
            "nightlight_year": 2025,
            "pois": [],
            "road_features": [],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["ok"] is True
    assert data["feature_collection"]["type"] == "FeatureCollection"


def test_gwr_api_accepts_empty_poi_and_road_payload(monkeypatch):
    client = TestClient(app)

    def fake_analyze_nightlight_gwr(**kwargs):
        assert kwargs["pois"] == []
        assert kwargs["road_features"] == []
        return {
            "summary": {
                "ok": False,
                "status": "有效样本不足：0/12",
                "engine": "arcgis",
                "sample_count": 0,
                "cell_count": 0,
                "variable_count": 5,
            },
            "variables": [],
            "cells": [],
            "feature_collection": {"type": "FeatureCollection", "features": [], "count": 0},
            "diagnostics": {},
            "engine_status": "有效样本不足：0/12",
        }

    monkeypatch.setattr(gwr_router_module, "analyze_nightlight_gwr", fake_analyze_nightlight_gwr)
    resp = client.post(
        "/api/v1/analysis/gwr",
        json={
            "polygon": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            "coord_type": "gcj02",
            "pois": [],
            "road_features": [],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["summary"]["ok"] is False
