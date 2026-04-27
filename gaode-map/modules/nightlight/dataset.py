from __future__ import annotations

import json
import logging
import threading
from collections import OrderedDict
from pathlib import Path
from typing import Any

from shapely.geometry import mapping
from shapely.geometry.base import BaseGeometry

from core.config import settings

from .common import DEFAULT_VARIABLE_NAME, MANIFEST_FILENAME, RADIANCE_UNIT, resolve_dir, year_label
from .types import NightlightClip, ResolvedDataset

logger = logging.getLogger(__name__)

_CACHE_LOCK = threading.Lock()
_CLIP_CACHE: "OrderedDict[str, NightlightClip]" = OrderedDict()
_CLIP_CACHE_MAX_ENTRIES = 16


def require_rasterio():
    try:
        import rasterio  # type: ignore
        from rasterio.mask import mask  # type: ignore
        from rasterio.transform import array_bounds  # type: ignore

        return rasterio, mask, array_bounds
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            f"nightlight rasterio import failed: {exc.__class__.__name__}: {exc}"
        ) from exc


def clear_clip_cache() -> None:
    with _CACHE_LOCK:
        _CLIP_CACHE.clear()


def manifest_path() -> Path:
    return resolve_dir(settings.nightlight_data_dir) / MANIFEST_FILENAME


def load_manifest() -> dict[str, Any]:
    path = manifest_path()
    if not path.exists():
        raise RuntimeError(f"nightlight manifest not found: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"nightlight manifest parse failed: {exc}") from exc

    datasets = payload.get("datasets")
    if not isinstance(datasets, list) or not datasets:
        raise RuntimeError("nightlight manifest datasets missing")

    available_years: list[dict[str, Any]] = []
    for item in datasets:
        try:
            year = int(item.get("year"))
        except Exception:
            continue
        file_value = str(item.get("file") or "").strip()
        if not file_value:
            continue
        available_years.append(
            {
                "year": year,
                "label": str(item.get("label") or year_label(year)),
                "file": file_value,
                "unit": str(item.get("unit") or RADIANCE_UNIT),
                "variable": str(item.get("variable") or DEFAULT_VARIABLE_NAME),
            }
        )
    if not available_years:
        raise RuntimeError("nightlight manifest contains no usable datasets")

    payload["datasets"] = sorted(available_years, key=lambda item: int(item["year"]))
    try:
        default_year = int(payload.get("default_year"))
    except Exception:
        default_year = int(payload["datasets"][-1]["year"])
    if default_year not in {int(item["year"]) for item in payload["datasets"]}:
        default_year = int(payload["datasets"][-1]["year"])
    payload["default_year"] = default_year
    return payload


def resolve_dataset(year: int | None = None) -> ResolvedDataset:
    manifest = load_manifest()
    target_year = int(year) if year is not None else int(manifest["default_year"])
    for item in manifest["datasets"]:
        if int(item["year"]) != target_year:
            continue
        dataset_path = resolve_dir(settings.nightlight_data_dir) / str(item["file"])
        if not dataset_path.exists():
            raise RuntimeError(f"nightlight dataset not found: {dataset_path}")
        return ResolvedDataset(
            year=target_year,
            label=str(item["label"]),
            file=str(item["file"]),
            path=dataset_path,
            unit=str(item.get("unit") or RADIANCE_UNIT),
            variable=str(item.get("variable") or DEFAULT_VARIABLE_NAME),
        )
    raise ValueError(f"nightlight dataset year unavailable: {target_year}")


def _clip_cache_key(scope_id: str, year: int, dataset_marker: str = "") -> str:
    return f"{year}:{scope_id}:{str(dataset_marker or '').strip()}"


def _push_clip_cache(key: str, clip: NightlightClip) -> NightlightClip:
    with _CACHE_LOCK:
        _CLIP_CACHE[key] = clip
        _CLIP_CACHE.move_to_end(key)
        while len(_CLIP_CACHE) > _CLIP_CACHE_MAX_ENTRIES:
            _CLIP_CACHE.popitem(last=False)
        return clip


def _get_clip_cache(key: str) -> NightlightClip | None:
    with _CACHE_LOCK:
        clip = _CLIP_CACHE.get(key)
        if clip is None:
            return None
        _CLIP_CACHE.move_to_end(key)
        return clip


def mask_dataset(dataset_path: Path, geom_wgs84: BaseGeometry) -> NightlightClip | None:
    rasterio, mask, _ = require_rasterio()
    with rasterio.open(dataset_path) as src:
        try:
            masked, masked_transform = mask(
                src,
                [mapping(geom_wgs84)],
                all_touched=True,
                crop=True,
                filled=False,
            )
        except ValueError:
            return None
        band = masked[0]
        if band.size == 0:
            return None
        return NightlightClip(
            array=band,
            transform=masked_transform,
            crs=src.crs,
            width=int(band.shape[1]),
            height=int(band.shape[0]),
            nodata=src.nodata,
            empty=False,
        )


def load_or_compute_clip(
    scope_id: str,
    year: int,
    dataset_path: Path,
    geom_wgs84: BaseGeometry,
) -> NightlightClip:
    key = _clip_cache_key(scope_id, year, str(dataset_path))
    cached = _get_clip_cache(key)
    if cached is not None:
        return cached
    clip = mask_dataset(dataset_path, geom_wgs84)
    if clip is None:
        return _push_clip_cache(key, NightlightClip.empty_clip())
    return _push_clip_cache(key, clip)
