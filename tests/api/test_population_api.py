import os
import sys
import base64
from pathlib import Path
import asyncio

import numpy as np

sys.path.append(str(Path(__file__).resolve().parents[2]))
os.environ.setdefault("AMAP_JS_API_KEY", "test-key")

import httpx

from core.config import settings
from main import app
from modules.population.registry import age_band_keys
from modules.providers.amap.utils.transform_posi import wgs84_to_gcj02

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def _write_population_test_rasters(root: Path, year: str = "2026"):
    import rasterio
    from rasterio.transform import from_origin

    root.mkdir(parents=True, exist_ok=True)
    transform = from_origin(121.46, 31.25, 0.01, 0.01)
    crs = "EPSG:4326"

    male_ages = {}
    female_ages = {}
    male_total = np.zeros((4, 4), dtype=np.float32)
    female_total = np.zeros((4, 4), dtype=np.float32)

    for idx, age_band in enumerate(age_band_keys(), start=1):
        male_arr = np.array(
            [
                [idx, idx + 1, idx + 2, idx + 3],
                [idx + 1, idx + 2, idx + 3, idx + 4],
                [idx + 2, idx + 3, idx + 4, idx + 5],
                [idx + 3, idx + 4, idx + 5, idx + 6],
            ],
            dtype=np.float32,
        )
        female_arr = male_arr * 0.8
        male_ages[age_band] = male_arr
        female_ages[age_band] = female_arr
        male_total += male_arr
        female_total += female_arr

    datasets = {
        f"chn_T_M_{year}_CN_100m_R2025A_v1.tif": male_total,
        f"chn_T_F_{year}_CN_100m_R2025A_v1.tif": female_total,
    }
    for age_band in age_band_keys():
        datasets[f"chn_m_{age_band}_{year}_CN_100m_R2025A_v1.tif"] = male_ages[age_band]
        datasets[f"chn_f_{age_band}_{year}_CN_100m_R2025A_v1.tif"] = female_ages[age_band]
        datasets[f"chn_t_{age_band}_{year}_CN_100m_R2025A_v1.tif"] = male_ages[age_band] + female_ages[age_band]

    for filename, data in datasets.items():
        path = root / filename
        with rasterio.open(
            path,
            "w",
            driver="GTiff",
            width=data.shape[1],
            height=data.shape[0],
            count=1,
            dtype="float32",
            crs=crs,
            transform=transform,
            nodata=0,
        ) as dst:
            dst.write(data, 1)


def _sample_gcj02_polygon():
    ring_wgs84 = [
        [121.462, 31.248],
        [121.498, 31.248],
        [121.498, 31.214],
        [121.462, 31.214],
        [121.462, 31.248],
    ]
    return [list(wgs84_to_gcj02(lng, lat)) for lng, lat in ring_wgs84]


def _configure_population_dirs(tmp_path: Path, year: str = "2026"):
    data_root = tmp_path / "population_data"
    data_dir = data_root / year
    _write_population_test_rasters(data_dir, year)
    settings.population_data_dir = str(data_root)
    settings.population_data_year = year
    settings.population_preview_max_size = 512
    return data_root


async def _request(method: str, url: str, **kwargs):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.request(method, url, **kwargs)


def test_population_meta_api():
    resp = asyncio.run(_request("GET", "/api/v1/analysis/population/meta"))
    assert resp.status_code == 200
    data = resp.json()
    assert data["default_sex"] == "total"
    assert data["default_age_band"] == "all"
    assert data["default_year"] == "2026"
    assert data["year_options"] == ["2024", "2025", "2026"]
    assert any(item["value"] == "male" for item in data["sex_options"])
    assert any(item["value"] == "90" for item in data["age_band_options"])


def test_population_overview_and_raster_api(tmp_path):
    _configure_population_dirs(tmp_path)
    grid_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/grid",
        json={"polygon": _sample_gcj02_polygon(), "coord_type": "gcj02"},
    ))
    assert grid_resp.status_code == 200
    grid = grid_resp.json()
    assert grid["cell_count"] > 0
    assert len(grid["features"]) == grid["cell_count"]
    first_props = (grid["features"][0] or {}).get("properties") or {}
    assert first_props["cell_id"]
    assert isinstance(first_props["centroid_gcj02"], list)

    overview_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/overview",
        json={"polygon": _sample_gcj02_polygon(), "coord_type": "gcj02"},
    ))
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["summary"]["total_population"] > 0
    assert overview["summary"]["male_total"] + overview["summary"]["female_total"] == overview["summary"]["total_population"]
    assert len(overview["age_distribution"]) == 20
    assert all(abs(item["total"] - (item["male"] + item["female"])) < 1e-6 for item in overview["age_distribution"])

    density_layer_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/layer",
        json={
            "polygon": _sample_gcj02_polygon(),
            "coord_type": "gcj02",
            "scope_id": overview["scope_id"],
            "view": "density",
        },
    ))
    assert density_layer_resp.status_code == 200
    density_layer = density_layer_resp.json()
    assert density_layer["selected"]["view"] == "density"
    assert density_layer["legend"]["unit"] == "人/平方公里"
    assert len(density_layer["cells"]) == grid["cell_count"]
    assert density_layer["summary"]["total_population"] > 0

    sex_layer_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/layer",
        json={
            "polygon": _sample_gcj02_polygon(),
            "coord_type": "gcj02",
            "scope_id": overview["scope_id"],
            "view": "sex",
            "sex_mode": "female",
        },
    ))
    assert sex_layer_resp.status_code == 200
    sex_layer = sex_layer_resp.json()
    assert sex_layer["selected"]["view"] == "sex"
    assert sex_layer["selected"]["sex_mode"] == "female"
    assert sex_layer["summary"]["female_total"] > 0

    age_layer_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/layer",
        json={
            "polygon": _sample_gcj02_polygon(),
            "coord_type": "gcj02",
            "scope_id": overview["scope_id"],
            "view": "age",
            "age_mode": "dominant",
            "age_band": "all",
        },
    ))
    assert age_layer_resp.status_code == 200
    age_layer = age_layer_resp.json()
    assert age_layer["selected"]["view"] == "age"
    assert age_layer["selected"]["age_mode"] == "dominant"
    assert age_layer["legend"]["kind"] == "categorical"
    assert len(age_layer["cells"]) == grid["cell_count"]
    assert age_layer["summary"]["dominant_cell_count"] > 0
    assert 0 <= age_layer["summary"]["dominant_cell_ratio"] <= 1

    raster_resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/raster",
        json={
            "polygon": _sample_gcj02_polygon(),
            "coord_type": "gcj02",
            "sex": "total",
            "age_band": "all",
            "scope_id": overview["scope_id"],
        },
    ))
    assert raster_resp.status_code == 200
    raster = raster_resp.json()
    assert raster["image_url"]
    assert len(raster["bounds_gcj02"]) == 2
    assert raster["legend"]["stops"]
    assert abs(raster["summary"]["selected_ratio_of_total"] - 1.0) < 1e-6
    assert str(raster["image_url"]).startswith("data:image/png;base64,")
    png_base64 = str(raster["image_url"]).split(",", 1)[1]
    png_bytes = base64.b64decode(png_base64)
    assert png_bytes.startswith(PNG_MAGIC)


def test_population_raster_age_specific_api(tmp_path):
    _configure_population_dirs(tmp_path)
    resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/raster",
        json={
            "polygon": _sample_gcj02_polygon(),
            "coord_type": "gcj02",
            "sex": "female",
            "age_band": "25",
        },
    ))
    assert resp.status_code == 200
    data = resp.json()
    assert data["selected"]["sex"] == "female"
    assert data["selected"]["age_band"] == "25"
    assert data["summary"]["selected_population"] > 0


def test_population_overview_api_supports_alternate_year(tmp_path):
    _configure_population_dirs(tmp_path, year="2025")
    resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/overview",
        json={"polygon": _sample_gcj02_polygon(), "coord_type": "gcj02", "year": "2025"},
    ))
    assert resp.status_code == 200
    data = resp.json()
    assert data["summary"]["total_population"] > 0


def test_population_missing_directory_returns_500(tmp_path):
    settings.population_data_dir = str(tmp_path / "missing_population_data")
    settings.population_data_year = "2026"
    resp = asyncio.run(_request(
        "POST",
        "/api/v1/analysis/population/overview",
        json={"polygon": _sample_gcj02_polygon(), "coord_type": "gcj02"},
    ))
    assert resp.status_code == 500
    assert "population data directory not found" in str(resp.json().get("detail") or "")
