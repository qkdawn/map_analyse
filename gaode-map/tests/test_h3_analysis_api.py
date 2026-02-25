import os
import sys
from pathlib import Path

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


def _sample_pois_gcj02():
    points_wgs84 = [
        (121.4737, 31.2304, "050000"),
        (121.4742, 31.2306, "060000"),
        (121.4740, 31.2302, "150000"),
    ]
    pois = []
    for idx, (lng, lat, type_code) in enumerate(points_wgs84):
        glng, glat = wgs84_to_gcj02(lng, lat)
        pois.append(
            {
                "id": str(idx + 1),
                "name": f"poi-{idx + 1}",
                "location": [glng, glat],
                "type": type_code,
            }
        )
    return pois


def test_h3_metrics_api_shape():
    client = TestClient(app)
    payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 10,
        "coord_type": "gcj02",
        "include_mode": "intersects",
        "min_overlap_ratio": 0.0,
        "pois": _sample_pois_gcj02(),
        "poi_coord_type": "gcj02",
        "neighbor_ring": 1,
    }
    resp = client.post("/api/v1/analysis/h3-metrics", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert "grid" in data and "summary" in data and "charts" in data
    assert data["grid"]["type"] == "FeatureCollection"
    assert data["summary"]["grid_count"] == len(data["grid"]["features"])
    assert data["summary"]["analysis_engine"] == "arcgis"
    assert data["summary"].get("gi_render_meta", {}).get("mode") == "fixed_z"
    assert data["summary"].get("lisa_render_meta", {}).get("mode") == "stddev"
    assert "gi_z_stats" in data["summary"]
    assert "lisa_i_stats" in data["summary"]
    assert "arcgis_image_url_gi" in data["summary"]
    assert "arcgis_image_url_lisa" in data["summary"]


def test_h3_metrics_poi_count_consistency():
    client = TestClient(app)
    payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 10,
        "coord_type": "gcj02",
        "include_mode": "intersects",
        "min_overlap_ratio": 0.0,
        "pois": _sample_pois_gcj02(),
        "poi_coord_type": "gcj02",
        "neighbor_ring": 1,
    }
    resp = client.post("/api/v1/analysis/h3-metrics", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assigned = sum((f.get("properties", {}).get("poi_count") or 0) for f in data["grid"]["features"])
    assert assigned == data["summary"]["poi_count"]


def test_h3_metrics_grid_count_changes_with_threshold():
    client = TestClient(app)
    base_payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 10,
        "coord_type": "gcj02",
        "include_mode": "intersects",
        "pois": _sample_pois_gcj02(),
        "poi_coord_type": "gcj02",
        "neighbor_ring": 1,
    }
    loose = client.post("/api/v1/analysis/h3-metrics", json={**base_payload, "min_overlap_ratio": 0.0})
    strict = client.post("/api/v1/analysis/h3-metrics", json={**base_payload, "min_overlap_ratio": 0.4})
    assert loose.status_code == 200
    assert strict.status_code == 200
    loose_count = loose.json()["summary"]["grid_count"]
    strict_count = strict.json()["summary"]["grid_count"]
    assert strict_count <= loose_count


def test_h3_metrics_spatial_structure_fields():
    client = TestClient(app)
    payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 10,
        "coord_type": "gcj02",
        "include_mode": "intersects",
        "min_overlap_ratio": 0.0,
        "pois": _sample_pois_gcj02(),
        "poi_coord_type": "gcj02",
        "neighbor_ring": 1,
    }
    resp = client.post("/api/v1/analysis/h3-metrics", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    props_list = [f.get("properties", {}) for f in data["grid"]["features"]]
    assert props_list
    assert all("gi_star_z_score" in p for p in props_list)
    assert all("lisa_i" in p for p in props_list)
    assert all("gi_star_p_value" not in p for p in props_list)
    assert all("lisa_p_value" not in p for p in props_list)
    assert all("gi_star_bin" not in p for p in props_list)
    assert all("lisa_cluster" not in p for p in props_list)
    assert all("spatial_structure_type" not in p for p in props_list)
    summary = data.get("summary", {})
    assert "significant_cell_count" not in summary
    assert "global_moran_p_value" not in summary
    assert "global_moran_significant" not in summary
    assert summary.get("gi_render_meta", {}).get("mode") == "fixed_z"
    assert summary.get("lisa_render_meta", {}).get("mode") == "stddev"


def test_h3_metrics_legacy_significance_payload_is_ignored():
    client = TestClient(app)
    payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 10,
        "coord_type": "gcj02",
        "include_mode": "intersects",
        "min_overlap_ratio": 0.0,
        "pois": _sample_pois_gcj02(),
        "poi_coord_type": "gcj02",
        "neighbor_ring": 1,
        "moran_permutations": 99,
        "significance_alpha": 0.1,
        "moran_seed": 1,
        "significance_fdr": True,
        "significance_local_sum_k": 888,
    }
    resp = client.post("/api/v1/analysis/h3-metrics", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    props_list = [f.get("properties", {}) for f in data["grid"]["features"]]
    assert props_list
    assert all("spatial_structure_type" not in p for p in props_list)


def test_h3_metrics_arcgis_failure_returns_502():
    client = TestClient(app)
    payload = {
        "polygon": _sample_gcj02_polygon(),
        "resolution": 10,
        "coord_type": "gcj02",
        "include_mode": "intersects",
        "min_overlap_ratio": 0.0,
        "pois": _sample_pois_gcj02(),
        "poi_coord_type": "gcj02",
        "neighbor_ring": 1,
        "use_arcgis": True,
        "arcgis_python_path": r"C:\\not_exists\\ArcGIS\\python.exe",
    }
    resp = client.post("/api/v1/analysis/h3-metrics", json=payload)
    assert resp.status_code == 502
    body = resp.json()
    assert "ArcGIS桥接失败" in str(body.get("detail") or "")


def test_h3_export_api_stream(monkeypatch):
    client = TestClient(app)

    def _fake_export(**kwargs):
        assert kwargs.get("export_format") == "gpkg"
        return {
            "filename": "h3_analysis_test.gpkg",
            "content_type": "application/geopackage+sqlite3",
            "content": b"gpkg-binary",
        }

    monkeypatch.setattr("router.app.run_arcgis_h3_export", _fake_export)

    payload = {
        "format": "gpkg",
        "include_poi": True,
        "style_mode": "density",
        "grid_features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[121.47, 31.23], [121.48, 31.23], [121.48, 31.24], [121.47, 31.24], [121.47, 31.23]]],
                },
                "properties": {"h3_id": "test", "density_poi_per_km2": 1.0},
            }
        ],
        "poi_features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [121.475, 31.235]},
                "properties": {"id": "1", "name": "poi-1", "type": "050000"},
            }
        ],
        "style_meta": {},
    }
    resp = client.post("/api/v1/analysis/h3/export", json=payload)
    assert resp.status_code == 200
    assert resp.content == b"gpkg-binary"
    assert "attachment; filename=\"h3_analysis_test.gpkg\"" in str(resp.headers.get("content-disposition") or "")


if __name__ == "__main__":
    test_h3_metrics_api_shape()
    test_h3_metrics_poi_count_consistency()
    test_h3_metrics_grid_count_changes_with_threshold()
    test_h3_metrics_spatial_structure_fields()
    test_h3_metrics_legacy_significance_payload_is_ignored()
    test_h3_metrics_arcgis_failure_returns_502()
    print("H3 analysis API tests passed.")
