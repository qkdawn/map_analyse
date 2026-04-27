import asyncio

import pytest
from fastapi import HTTPException
from shapely.geometry import Point

import router.app as app_module
from modules.isochrone.schemas import IsochroneDebugSampleRequest


def _build_payload(**overrides):
    data = {
        "lat": 0.0005,
        "lon": 0.0005,
        "time_min": 15,
        "mode": "walking",
        "coord_type": "wgs84",
        "clip_polygon": [
            [0.0, 0.0],
            [0.001, 0.0],
            [0.001, 0.001],
            [0.0, 0.001],
            [0.0, 0.0],
        ],
        "sample_boundary_step_m": 300,
        "sample_max_points": None,
    }
    data.update(overrides)
    return IsochroneDebugSampleRequest(**data)


def test_debug_samples_returns_points_and_single_sample_isochrones(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "_build_scope_sample_points",
        lambda *args, **kwargs: [[0.0, 0.0], [0.001, 0.001]],
    )
    monkeypatch.setattr(
        app_module,
        "get_isochrone_polygon",
        lambda lat, lon, time_sec, mode: Point(float(lon), float(lat)).buffer(0.00005),
    )

    response = asyncio.run(app_module.debug_isochrone_samples(_build_payload()))

    assert response["meta"]["origin_count"] == 2
    assert response["meta"]["errors"] == []
    assert len(response["sample_points"]) == 2
    assert len(response["isochrone_features"]) == 2
    assert response["isochrone_features"][0]["properties"]["sample_id"] == "sample_001"
    assert response["scope_geometry"]["type"] == "Polygon"


def test_debug_samples_accepts_null_sample_max_points(monkeypatch):
    seen = {}

    def fake_build_scope_sample_points(*args, **kwargs):
        seen["max_points"] = kwargs.get("max_points")
        return [[0.0, 0.0]]

    monkeypatch.setattr(app_module, "_build_scope_sample_points", fake_build_scope_sample_points)
    monkeypatch.setattr(
        app_module,
        "get_isochrone_polygon",
        lambda lat, lon, time_sec, mode: Point(float(lon), float(lat)).buffer(0.00005),
    )

    response = asyncio.run(app_module.debug_isochrone_samples(_build_payload(sample_max_points=None)))

    assert seen["max_points"] is None
    assert response["meta"]["origin_count"] == 1


def test_debug_samples_records_partial_failures(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "_build_scope_sample_points",
        lambda *args, **kwargs: [[0.0, 0.0], [0.001, 0.001]],
    )

    def fake_get_isochrone_polygon(lat, lon, time_sec, mode):
        if float(lon) > 0.0005:
            raise RuntimeError("synthetic sample failure")
        return Point(float(lon), float(lat)).buffer(0.00005)

    monkeypatch.setattr(app_module, "get_isochrone_polygon", fake_get_isochrone_polygon)

    response = asyncio.run(app_module.debug_isochrone_samples(_build_payload()))

    assert len(response["isochrone_features"]) == 1
    assert len(response["meta"]["errors"]) == 1
    assert response["meta"]["errors"][0]["sample_id"] == "sample_002"


def test_debug_samples_returns_502_when_all_samples_fail(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "_build_scope_sample_points",
        lambda *args, **kwargs: [[0.0, 0.0], [0.001, 0.001]],
    )
    monkeypatch.setattr(
        app_module,
        "get_isochrone_polygon",
        lambda lat, lon, time_sec, mode: (_ for _ in ()).throw(RuntimeError("all failed")),
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(app_module.debug_isochrone_samples(_build_payload()))

    assert exc_info.value.status_code == 502


def test_debug_samples_rejects_invalid_clip_polygon():
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            app_module.debug_isochrone_samples(
                _build_payload(clip_polygon=[[0.0, 0.0], [0.001, 0.0], [0.0, 0.0]])
            )
        )

    assert exc_info.value.status_code == 400
