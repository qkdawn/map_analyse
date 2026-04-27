import asyncio
import io
import json
import os
import sys
import zipfile
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.append(str(Path(__file__).resolve().parents[2]))
os.environ.setdefault("AMAP_JS_API_KEY", "test-key")

from modules.export.schemas import AnalysisExportBundleRequest
from router.domains.export import export_analysis_bundle


class _FakeRequest:
    def __init__(self, headers=None):
        self.headers = headers or {}


def _read_zip(content: bytes):
    with zipfile.ZipFile(io.BytesIO(content), "r") as zf:
        names = zf.namelist()
        files = {name: zf.read(name) for name in names}
    return names, files


def _sample_polygon_feature():
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [121.47, 31.23],
                    [121.48, 31.23],
                    [121.48, 31.24],
                    [121.47, 31.24],
                    [121.47, 31.23],
                ]
            ],
        },
        "properties": {"h3_id": "test-h3", "density_poi_per_km2": 1.0, "poi_count": 2},
    }


def _sample_png_data_url():
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII="


def test_export_bundle_basic_success():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["overview_json", "isochrone_geojson"],
        coord_type="gcj02",
        context={"mode": "walking"},
        isochrone_feature={
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [121.47, 31.23],
                        [121.48, 31.23],
                        [121.48, 31.24],
                        [121.47, 31.24],
                        [121.47, 31.23],
                    ]
                ],
            },
            "properties": {"mode": "walking"},
        },
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    assert resp.media_type == "application/zip"

    names, files = _read_zip(resp.body)
    assert "manifest.json" in names
    assert "01_overview/result_overview.json" in names
    assert "02_scope/isochrone.geojson" in names

    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    included = {item["file"] for item in manifest.get("included_files") or []}
    assert "01_overview/result_overview.json" in included
    assert "02_scope/isochrone.geojson" in included


def test_export_bundle_skips_empty_part_but_still_200():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["overview_json", "isochrone_geojson"],
        coord_type="gcj02",
        context={"mode": "walking"},
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    _, files = _read_zip(resp.body)
    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    skipped = manifest.get("skipped_parts") or []
    assert any(item.get("part") == "isochrone_geojson" for item in skipped)


def test_export_bundle_frontend_charts_success():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["frontend_charts_png"],
        coord_type="gcj02",
        frontend_charts=[
            {"chart_id": "poi_category", "png_base64": _sample_png_data_url()},
            {"chart_id": "h3_density_histogram", "png_base64": _sample_png_data_url()},
        ],
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    names, files = _read_zip(resp.body)
    assert "07_charts/poi_category.png" in names
    assert "07_charts/h3_density_histogram.png" in names

    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    included = {item["file"] for item in manifest.get("included_files") or []}
    assert "07_charts/poi_category.png" in included
    assert "07_charts/h3_density_histogram.png" in included


def test_export_bundle_frontend_charts_invalid_png_skipped():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["overview_json", "frontend_charts_png"],
        coord_type="gcj02",
        frontend_charts=[
            {"chart_id": "poi_category", "png_base64": "data:image/png;base64,not-valid"},
        ],
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    _, files = _read_zip(resp.body)
    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    skipped = manifest.get("skipped_parts") or []
    assert any(
        item.get("part") == "frontend_charts_png"
        and item.get("chart_id") == "poi_category"
        for item in skipped
    )


def test_export_bundle_panel_png_success():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["poi_panel_png", "h3_metric_panel_png"],
        coord_type="gcj02",
        frontend_panels=[
            {"panel_id": "poi_panel", "png_base64": _sample_png_data_url()},
            {"panel_id": "h3_metric_panel", "png_base64": _sample_png_data_url()},
        ],
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    names, files = _read_zip(resp.body)
    assert "07_panels/poi_panel.png" in names
    assert "07_panels/h3_metric_panel.png" in names

    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    included = {item["file"] for item in manifest.get("included_files") or []}
    assert "07_panels/poi_panel.png" in included
    assert "07_panels/h3_metric_panel.png" in included


def test_export_bundle_panel_png_invalid_skipped():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["overview_json", "poi_panel_png"],
        coord_type="gcj02",
        frontend_panels=[
            {"panel_id": "poi_panel", "png_base64": "data:image/png;base64,broken"},
        ],
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    _, files = _read_zip(resp.body)
    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    skipped = manifest.get("skipped_parts") or []
    assert any(
        item.get("part") == "poi_panel_png"
        and item.get("panel_id") == "poi_panel"
        for item in skipped
    )


def test_export_bundle_ai_structured_success():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["ai_report_json", "ai_facts_json", "ai_context_md"],
        coord_type="gcj02",
        context={"mode": "walking", "time_min": 15, "source": "local"},
        isochrone_feature={
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [121.47, 31.23],
                        [121.48, 31.23],
                        [121.48, 31.24],
                        [121.47, 31.24],
                        [121.47, 31.23],
                    ]
                ],
            },
            "properties": {"mode": "walking"},
        },
        pois=[
            {"id": "p1", "name": "poi-1", "type": "购物", "location": [121.471, 31.231]},
            {"id": "p2", "name": "poi-2", "type": "餐饮", "location": [121.472, 31.232]},
        ],
        h3={
            "grid_features": [_sample_polygon_feature()],
            "summary": {"avg_density_poi_per_km2": 123.45, "global_moran_i_density": 0.42},
            "charts": {},
            "style_meta": {},
        },
        road_syntax={
            "roads": {"type": "FeatureCollection", "features": []},
            "summary": {"total_length_km": 12.3, "node_count": 88},
            "nodes": {},
            "diagnostics": {},
        },
        frontend_analysis={"poi": {"note": "from panel"}},
    )
    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    names, files = _read_zip(resp.body)
    assert "09_ai/ai_report.json" in names
    assert "09_ai/ai_facts.json" in names
    assert "09_ai/prompt_context.md" in names

    report = json.loads(files["09_ai/ai_report.json"].decode("utf-8"))
    assert report.get("meta", {}).get("coord_type") == "gcj02"
    assert report.get("poi", {}).get("count") == 2

    facts = json.loads(files["09_ai/ai_facts.json"].decode("utf-8"))
    assert facts.get("poi_total") == 2
    assert facts.get("h3_grid_count") == 1


def test_export_bundle_ai_panel_json_success():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["poi_panel_json", "h3_metric_panel_json", "road_connectivity_panel_json"],
        coord_type="gcj02",
        context={"mode": "walking", "time_min": 15, "source": "local"},
        pois=[
            {"id": "p1", "name": "poi-1", "type": "购物", "location": [121.471, 31.231]},
        ],
        h3={
            "grid_features": [_sample_polygon_feature()],
            "summary": {"avg_density_poi_per_km2": 88.8},
            "charts": {"hist": {"bins": [1, 2, 3]}},
            "style_meta": {},
        },
        road_syntax={
            "roads": {"type": "FeatureCollection", "features": []},
            "summary": {"total_length_km": 12.3},
            "nodes": {},
            "diagnostics": {},
        },
        frontend_analysis={
            "poi": {"panel_state": "ok"},
            "h3": {"panel_state": "ok"},
            "road": {"panel_state": "ok"},
        },
    )
    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    names, files = _read_zip(resp.body)
    assert "09_ai/panels/poi_panel.json" in names
    assert "09_ai/panels/h3_metric_panel.json" in names
    assert "09_ai/panels/road_connectivity_panel.json" in names

    poi_panel = json.loads(files["09_ai/panels/poi_panel.json"].decode("utf-8"))
    assert poi_panel.get("domain") == "poi"
    assert poi_panel.get("data", {}).get("poi_count") == 1


def test_export_bundle_h3_gpkg_success(monkeypatch):
    def _fake_export(**kwargs):
        assert kwargs.get("export_format") == "gpkg"
        return {
            "filename": "h3_analysis.gpkg",
            "content_type": "application/geopackage+sqlite3",
            "content": b"gpkg-data",
        }

    monkeypatch.setattr("modules.export.builder.run_arcgis_h3_export", _fake_export)

    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["h3_gpkg"],
        coord_type="gcj02",
        h3={
            "grid_features": [_sample_polygon_feature()],
            "summary": {},
            "charts": {},
            "style_meta": {},
        },
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    names, _ = _read_zip(resp.body)
    assert "06_h3_professional/h3_analysis.gpkg" in names


def test_export_bundle_h3_arcgis_package_success(monkeypatch):
    def _fake_export(**kwargs):
        assert kwargs.get("export_format") == "arcgis_package"
        return {
            "filename": "h3_analysis.zip",
            "content_type": "application/zip",
            "content": b"arcgis-zip",
        }

    monkeypatch.setattr("modules.export.builder.run_arcgis_h3_export", _fake_export)

    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["h3_arcgis_package"],
        coord_type="gcj02",
        h3={
            "grid_features": [_sample_polygon_feature()],
            "summary": {},
            "charts": {},
            "style_meta": {},
        },
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    names, _ = _read_zip(resp.body)
    assert "06_h3_professional/h3_analysis_arcgis_package.zip" in names


def test_export_bundle_professional_fail_with_basic_still_200(monkeypatch):
    def _fake_export(**kwargs):
        raise RuntimeError("arcgis unavailable")

    monkeypatch.setattr("modules.export.builder.run_arcgis_h3_export", _fake_export)

    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["overview_json", "h3_gpkg"],
        coord_type="gcj02",
        context={"mode": "walking"},
        h3={
            "grid_features": [_sample_polygon_feature()],
            "summary": {},
            "charts": {},
            "style_meta": {},
        },
    )

    resp = asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    _, files = _read_zip(resp.body)
    manifest = json.loads(files["manifest.json"].decode("utf-8"))
    errors = manifest.get("errors") or []
    assert any(item.get("part") == "h3_gpkg" for item in errors)


def test_export_bundle_only_professional_fail_returns_502(monkeypatch):
    def _fake_export(**kwargs):
        raise RuntimeError("arcgis unavailable")

    monkeypatch.setattr("modules.export.builder.run_arcgis_h3_export", _fake_export)

    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["h3_gpkg"],
        coord_type="gcj02",
        h3={
            "grid_features": [_sample_polygon_feature()],
            "summary": {},
            "charts": {},
            "style_meta": {},
        },
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    assert exc.value.status_code == 502


def test_export_bundle_all_invalid_returns_400():
    payload = AnalysisExportBundleRequest(
        template="business_common",
        parts=["isochrone_geojson"],
        coord_type="gcj02",
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(export_analysis_bundle(payload, _FakeRequest()))
    assert exc.value.status_code == 400
