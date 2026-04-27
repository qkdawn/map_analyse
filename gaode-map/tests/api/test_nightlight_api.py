import asyncio
import os
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
sys.path.append(str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("AMAP_JS_API_KEY", "test-key")

import httpx  # noqa: E402

from main import app  # noqa: E402
from nightlight_test_utils import configure_nightlight_dir, sample_gcj02_polygon  # noqa: E402


async def _request(method: str, url: str, **kwargs):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, url, **kwargs)


def test_nightlight_meta_api(tmp_path):
    configure_nightlight_dir(tmp_path, year=2025)

    resp = asyncio.run(_request("GET", "/api/v1/analysis/nightlight/meta"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_year"] == 2025
    assert data["available_years"] == [{"year": 2025, "label": "2025 年"}]


def test_nightlight_overview_grid_layer_and_raster_api(tmp_path):
    configure_nightlight_dir(tmp_path, year=2025)
    polygon = sample_gcj02_polygon()

    population_grid_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/grid",
        json={"polygon": polygon, "coord_type": "gcj02"},
    ))
    assert population_grid_resp.status_code == 200
    population_grid = population_grid_resp.json()

    grid_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/nightlight/grid",
        json={"polygon": polygon, "coord_type": "gcj02", "year": 2025},
    ))
    assert grid_resp.status_code == 200
    grid = grid_resp.json()
    assert grid["cell_count"] > 0
    assert len(grid["features"]) == grid["cell_count"]
    assert grid["cell_count"] == population_grid["cell_count"]
    grid_ids = {str((feature.get("properties") or {}).get("cell_id") or "") for feature in grid["features"]}
    population_ids = {str((feature.get("properties") or {}).get("cell_id") or "") for feature in population_grid["features"]}
    assert "" not in grid_ids
    assert grid_ids == population_ids

    overview_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/nightlight/overview",
        json={"polygon": polygon, "coord_type": "gcj02", "year": 2025},
    ))
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["year"] == 2025
    assert abs(overview["summary"]["total_radiance"] - 136.0) < 1e-6

    layer_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/nightlight/layer",
        json={
            "polygon": polygon,
            "coord_type": "gcj02",
            "year": 2025,
            "scope_id": overview["scope_id"],
            "view": "radiance",
        },
    ))
    assert layer_resp.status_code == 200
    layer = layer_resp.json()
    assert layer["selected"]["view"] == "radiance"
    assert layer["legend"]["unit"] == "nWatts/(cm^2 sr)"
    assert len(layer["cells"]) == grid["cell_count"]
    layer_ids = {str((cell or {}).get("cell_id") or "") for cell in layer["cells"]}
    assert layer_ids == grid_ids
    assert any(float((cell or {}).get("value") or 0.0) > 0.0 for cell in layer["cells"])

    raster_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/nightlight/raster",
        json={
            "polygon": polygon,
            "coord_type": "gcj02",
            "year": 2025,
            "scope_id": overview["scope_id"],
        },
    ))
    assert raster_resp.status_code == 200
    raster = raster_resp.json()
    assert raster["image_url"].startswith("data:image/png;base64,")
    assert len(raster["bounds_gcj02"]) == 2
    assert raster["summary"]["valid_pixel_count"] == 16


def test_nightlight_unavailable_year_returns_400(tmp_path):
    configure_nightlight_dir(tmp_path, year=2025)

    resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/nightlight/overview",
        json={"polygon": sample_gcj02_polygon(), "coord_type": "gcj02", "year": 2024},
    ))
    assert resp.status_code == 400
    assert "nightlight dataset year unavailable" in str(resp.json().get("detail") or "")
