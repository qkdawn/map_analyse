import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from core.config import settings
from modules.nightlight.dataset import clear_clip_cache
from modules.population import service as population_service
from modules.population.registry import age_band_keys
from modules.providers.amap.utils.transform_posi import wgs84_to_gcj02


def write_nightlight_test_dataset(
    root: Path,
    year: int = 2025,
    data: np.ndarray | None = None,
    nodata: float = -9999.0,
) -> Path:
    annual_dir = root / "annual"
    annual_dir.mkdir(parents=True, exist_ok=True)
    tif_path = annual_dir / f"black_marble_{year}_china.tif"

    if data is None:
        data = np.array(
            [
                [1, 2, 3, 4],
                [5, 6, 7, 8],
                [9, 10, 11, 12],
                [13, 14, 15, 16],
            ],
            dtype=np.float32,
        )
    data = np.asarray(data, dtype=np.float32)
    transform = from_origin(121.46, 31.25, 0.01, 0.01)
    with rasterio.open(
        tif_path,
        "w",
        driver="GTiff",
        width=data.shape[1],
        height=data.shape[0],
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
        nodata=nodata,
    ) as dst:
        dst.write(data, 1)

    manifest = {
        "default_year": int(year),
        "datasets": [
            {
                "year": int(year),
                "label": f"{int(year)} 年",
                "file": f"annual/{tif_path.name}",
                "unit": "nWatts/(cm^2 sr)",
                "variable": "NearNadir_Composite_Snow_Free",
            }
        ],
    }
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return tif_path


def sample_gcj02_polygon():
    ring_wgs84 = [
        [121.462, 31.248],
        [121.498, 31.248],
        [121.498, 31.214],
        [121.462, 31.214],
        [121.462, 31.248],
    ]
    return [list(wgs84_to_gcj02(lng, lat)) for lng, lat in ring_wgs84]


def write_population_test_dataset(root: Path, year: str = "2026") -> Path:
    root = root / str(year)
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
    return root


def configure_nightlight_dir(tmp_path: Path, year: int = 2025) -> Path:
    data_dir = tmp_path / "nightlight_data"
    write_nightlight_test_dataset(data_dir, year=year)
    population_dir = tmp_path / "population_data"
    write_population_test_dataset(population_dir)
    settings.nightlight_data_dir = str(data_dir)
    settings.nightlight_preview_max_size = 512
    settings.population_data_dir = str(population_dir)
    settings.population_data_year = "2026"
    clear_clip_cache()
    population_service._IN_MEMORY_JSON_CACHE.clear()
    return data_dir
