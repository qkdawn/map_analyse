#!/usr/bin/env python3
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import h5py
import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.transform import from_bounds


BASE_ARCHIVE_URL = "https://ladsweb.modaps.eosdis.nasa.gov/archive/allData/5200/VNP46A4"
DEFAULT_VARIABLE_NAME = "NearNadir_Composite_Snow_Free"
DEFAULT_UNIT = "nWatts/(cm^2 sr)"
CHINA_TILE_PATTERN = re.compile(r"VNP46A4\.A(?P<year>\d{4})001\.h(25|26|27|28|29|30|31)v0[3-7]\.002\.[0-9]+\.h5")
NODATA_VALUE = -9999.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download and prepare annual Black Marble GeoTIFF for China coverage.")
    parser.add_argument("--year", type=int, default=2025)
    parser.add_argument("--data-root", type=Path, default=Path("E:/NightlightData"))
    parser.add_argument("--token-env", default="EARTHDATA_TOKEN")
    parser.add_argument("--keep-raw", action="store_true")
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument(
        "--download-workers",
        type=int,
        default=4,
        help="Number of parallel HDF5 tile downloads.",
    )
    return parser.parse_args()


def require_token(env_name: str) -> str:
    token = str(os.environ.get(env_name) or "").strip()
    if not token:
        raise SystemExit(f"missing token: environment variable {env_name} is required")
    return token


def run_curl(args: list[str], *, capture_output: bool = True) -> str:
    cmd = ["curl", "-fsSL", "--http1.1", "--tlsv1.2", *args]
    result = subprocess.run(
        cmd,
        check=False,
        capture_output=capture_output,
        text=True,
    )
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        redacted = []
        skip_next = False
        for item in cmd:
            if skip_next:
                redacted.append("<redacted>")
                skip_next = False
                continue
            redacted.append(item)
            if item == "--header":
                skip_next = True
        raise SystemExit(f"curl failed ({result.returncode}): {' '.join(redacted)}{f' :: {stderr}' if stderr else ''}")
    return result.stdout if capture_output else ""


def scalar_attr(value, default=None):
    if value is None:
        return default
    if isinstance(value, np.ndarray):
        if value.size <= 0:
            return default
        return value.reshape(-1)[0].item()
    if isinstance(value, (list, tuple)):
        if not value:
            return default
        return value[0]
    return value


def bundled_tile_list_path(year: int) -> Path:
    repo_root = Path(__file__).resolve().parents[2] / "gaode-map"
    return repo_root / "runtime" / "nightlight_data" / "raw" / str(year) / "files.txt"


def load_tile_names_from_file(path: Path) -> list[str]:
    if not path.exists():
        return []
    names = [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and CHINA_TILE_PATTERN.fullmatch(line.strip())
    ]
    return sorted(dict.fromkeys(names))


def fetch_tile_names(year: int, cache_path: Path | None = None) -> list[str]:
    if cache_path:
        names = load_tile_names_from_file(cache_path)
        if names:
            return names

    bundled_path = bundled_tile_list_path(year)
    names = load_tile_names_from_file(bundled_path)
    if names:
        if cache_path and cache_path != bundled_path:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text("\n".join(names) + "\n", encoding="utf-8")
        return names

    url = f"{BASE_ARCHIVE_URL}/{year}/001/"
    html = run_curl([url])
    names = sorted(set(match.group(0) for match in CHINA_TILE_PATTERN.finditer(html)))
    if not names:
        raise SystemExit(f"no China tile names found in {url}")
    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text("\n".join(names) + "\n", encoding="utf-8")
    return names


def is_valid_hdf5(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 1024 * 1024:
        return False
    try:
        if not h5py.is_hdf5(path):
            return False
        with h5py.File(path, "r") as handle:
            next(iter(handle.keys()), None)
        return True
    except Exception:
        return False


def download_file(url: str, target_path: Path, token: str, timeout: int) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 8):
        if target_path.exists() and not is_valid_hdf5(target_path):
            target_path.unlink(missing_ok=True)
        try:
            run_curl(
                [
                    "--connect-timeout",
                    str(timeout),
                    "--retry",
                    "8",
                    "--retry-delay",
                    "2",
                    "--retry-all-errors",
                    "--continue-at",
                    "-",
                    "--header",
                    f"Authorization: Bearer {token}",
                    "-o",
                    str(target_path),
                    url,
                ],
                capture_output=False,
            )
        except SystemExit:
            if attempt >= 7:
                raise
            time.sleep(min(10, attempt * 2))
            continue

        if is_valid_hdf5(target_path):
            return

        if target_path.exists() and target_path.stat().st_size < 1024 * 1024:
            head = target_path.read_text(encoding="utf-8", errors="ignore")[:200]
            if "<!DOCTYPE html" in head or "<html" in head.lower():
                raise SystemExit(f"download returned HTML instead of HDF5 for {target_path.name}")

        if attempt >= 7:
            raise SystemExit(f"download produced invalid HDF5 for {target_path.name}")
        time.sleep(min(10, attempt * 2))


def ensure_tile_downloaded(
    *,
    year: int,
    name: str,
    raw_dir: Path,
    token: str,
    timeout: int,
) -> Path:
    raw_path = raw_dir / name
    if not is_valid_hdf5(raw_path):
        url = f"{BASE_ARCHIVE_URL}/{year}/001/{name}"
        print(f"[download] {name}", flush=True)
        download_file(url, raw_path, token=token, timeout=timeout)
    else:
        print(f"[skip] {name}", flush=True)
    return raw_path


def locate_dataset(handle: h5py.File, dataset_name: str):
    found = None

    def _visitor(name, obj):
        nonlocal found
        if found is not None or not isinstance(obj, h5py.Dataset):
            return
        if Path(name).name == dataset_name:
            found = obj

    handle.visititems(_visitor)
    if found is None:
        raise RuntimeError(f"dataset not found in HDF5: {dataset_name}")
    return found


def extract_tile_to_geotiff(h5_path: Path, tif_path: Path, dataset_name: str = DEFAULT_VARIABLE_NAME) -> Path:
    with h5py.File(h5_path, "r") as handle:
        data_ds = locate_dataset(handle, dataset_name)
        lat_ds = locate_dataset(handle, "lat")
        lon_ds = locate_dataset(handle, "lon")

        data = np.asarray(data_ds[...], dtype=np.float32)
        lat = np.asarray(lat_ds[...], dtype=np.float64)
        lon = np.asarray(lon_ds[...], dtype=np.float64)

        fill_value = scalar_attr(data_ds.attrs.get("_FillValue", None), None)
        scale_factor = float(scalar_attr(data_ds.attrs.get("scale_factor", 1.0), 1.0))

        if fill_value is not None:
            try:
                fill_value = float(fill_value)
                data = np.where(data == fill_value, np.nan, data)
            except Exception:
                pass

        data = data * scale_factor
        data = np.where(np.isfinite(data), np.maximum(data, 0.0), NODATA_VALUE).astype(np.float32)

        width = int(data.shape[1])
        height = int(data.shape[0])
        if lat.ndim != 1 or lon.ndim != 1:
            raise RuntimeError(f"lat/lon arrays must be 1D: {h5_path}")
        west = float(np.min(lon))
        east = float(np.max(lon))
        south = float(np.min(lat))
        north = float(np.max(lat))
        transform = from_bounds(west, south, east, north, width, height)

        tif_path.parent.mkdir(parents=True, exist_ok=True)
        with rasterio.open(
            tif_path,
            "w",
            driver="GTiff",
            width=width,
            height=height,
            count=1,
            dtype="float32",
            crs="EPSG:4326",
            transform=transform,
            nodata=NODATA_VALUE,
            compress="deflate",
        ) as dst:
            dst.write(data, 1)
    return tif_path


def build_manifest(processed_dir: Path, year: int, tif_name: str) -> Path:
    manifest_path = processed_dir / "manifest.json"
    payload = {
        "default_year": int(year),
        "datasets": [
            {
                "year": int(year),
                "label": f"{int(year)} 年",
                "file": f"annual/{tif_name}",
                "unit": DEFAULT_UNIT,
                "variable": DEFAULT_VARIABLE_NAME,
            }
        ],
    }
    manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest_path


def main() -> None:
    args = parse_args()
    token = require_token(args.token_env)
    raw_dir = args.data_root / "raw" / str(args.year)
    processed_dir = args.data_root / "processed"
    annual_dir = processed_dir / "annual"
    output_name = f"black_marble_{int(args.year)}_china.tif"
    output_path = annual_dir / output_name
    tile_list_path = raw_dir / "files.txt"

    tile_names = fetch_tile_names(args.year, cache_path=tile_list_path)
    print(f"[nightlight] year={args.year} china_tiles={len(tile_names)}")

    download_workers = max(1, int(args.download_workers or 1))
    if download_workers > 1:
        print(f"[nightlight] download_workers={download_workers}")

    raw_paths: list[Path] = []
    with ThreadPoolExecutor(max_workers=download_workers) as executor:
        future_map = {
            executor.submit(
                ensure_tile_downloaded,
                year=args.year,
                name=name,
                raw_dir=raw_dir,
                token=token,
                timeout=args.timeout,
            ): index
            for index, name in enumerate(tile_names)
        }
        ordered_raw_paths: list[Path | None] = [None] * len(tile_names)
        for future in as_completed(future_map):
            index = future_map[future]
            ordered_raw_paths[index] = future.result()
        raw_paths = [path for path in ordered_raw_paths if path is not None]

    with tempfile.TemporaryDirectory(prefix="nightlight_prepare_") as temp_dir:
        temp_root = Path(temp_dir)
        geotiff_paths = []
        for raw_path in raw_paths:
            temp_tif = temp_root / f"{raw_path.stem}.tif"
            print(f"[convert] {raw_path.name}", flush=True)
            geotiff_paths.append(extract_tile_to_geotiff(raw_path, temp_tif))

        datasets = [rasterio.open(path) for path in geotiff_paths]
        try:
            mosaic, transform = merge(datasets, nodata=NODATA_VALUE)
            annual_dir.mkdir(parents=True, exist_ok=True)
            meta = datasets[0].meta.copy()
            meta.update(
                {
                    "driver": "GTiff",
                    "height": mosaic.shape[1],
                    "width": mosaic.shape[2],
                    "transform": transform,
                    "count": 1,
                    "nodata": NODATA_VALUE,
                    "compress": "deflate",
                }
            )
            with rasterio.open(output_path, "w", **meta) as dest:
                dest.write(mosaic[0], 1)
        finally:
            for dataset in datasets:
                dataset.close()

    manifest_path = build_manifest(processed_dir, args.year, output_name)
    print(f"[manifest] {manifest_path}")
    print(f"[output] {output_path}")

    if not args.keep_raw and raw_dir.exists():
        shutil.rmtree(raw_dir)
        print(f"[cleanup] removed raw dir {raw_dir}")


if __name__ == "__main__":
    main()
