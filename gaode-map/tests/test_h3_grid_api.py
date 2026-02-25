import os
import sys
from pathlib import Path

# Keep imports predictable in local runs
sys.path.append(str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("AMAP_JS_API_KEY", "test-key")

from fastapi.testclient import TestClient

from main import app
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


def test_h3_grid_api_returns_feature_collection():
    client = TestClient(app)
    payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 9,
        "coord_type": "gcj02",
        "include_mode": "intersects",
    }

    resp = client.post("/api/v1/analysis/h3-grid", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["type"] == "FeatureCollection"
    assert data["count"] == len(data["features"])
    assert data["count"] > 0


def test_h3_grid_api_supports_wgs84_input():
    client = TestClient(app)
    payload = {
        "polygon": _sample_wgs84_polygon(),
        "resolution": 9,
        "coord_type": "wgs84",
        "include_mode": "inside",
    }

    resp = client.post("/api/v1/analysis/h3-grid", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["type"] == "FeatureCollection"
    assert data["count"] == len(data["features"])


def test_h3_grid_api_overlap_ratio_filter():
    client = TestClient(app)
    base_payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 10,
        "coord_type": "gcj02",
        "include_mode": "intersects",
    }

    loose_resp = client.post("/api/v1/analysis/h3-grid", json={**base_payload, "min_overlap_ratio": 0.0})
    strict_resp = client.post("/api/v1/analysis/h3-grid", json={**base_payload, "min_overlap_ratio": 0.4})
    assert loose_resp.status_code == 200
    assert strict_resp.status_code == 200

    loose = loose_resp.json()
    strict = strict_resp.json()
    assert strict["count"] <= loose["count"]


if __name__ == "__main__":
    test_h3_grid_api_returns_feature_collection()
    test_h3_grid_api_supports_wgs84_input()
    test_h3_grid_api_overlap_ratio_filter()
    print("H3 API tests passed.")
