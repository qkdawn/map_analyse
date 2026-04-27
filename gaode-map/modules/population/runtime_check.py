from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict

from core.config import settings
from .registry import normalize_population_year, resolve_population_data_dir

logger = logging.getLogger(__name__)


def _resolve_dir(path_value: str) -> Path:
    path = Path(path_value).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (Path(__file__).resolve().parents[2] / path).resolve()


def run_population_runtime_check() -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "ok": True,
        "rasterio_ok": False,
        "pillow_ok": False,
        "data_dir_exists": False,
        "errors": [],
    }

    try:
        import rasterio  # type: ignore

        result["rasterio_ok"] = True
        result["rasterio_version"] = getattr(rasterio, "__version__", "unknown")
    except Exception as exc:  # pragma: no cover
        result["ok"] = False
        result["errors"].append(
            f"rasterio import failed: {exc.__class__.__name__}: {exc}"
        )

    try:
        from PIL import Image  # type: ignore

        result["pillow_ok"] = True
        result["pillow_version"] = getattr(Image, "__version__", "unknown")
    except Exception as exc:  # pragma: no cover
        result["ok"] = False
        result["errors"].append(
            f"pillow import failed: {exc.__class__.__name__}: {exc}"
        )

    data_dir = resolve_population_data_dir(
        _resolve_dir(settings.population_data_dir),
        normalize_population_year(settings.population_data_year),
    )
    result["data_dir"] = str(data_dir)
    result["data_dir_exists"] = data_dir.exists()
    if not data_dir.exists():
        result["ok"] = False
        result["errors"].append(f"population data directory not found: {data_dir}")

    if result["ok"]:
        logger.info(
            "Population runtime check passed: rasterio=%s pillow=%s data_dir=%s",
            result.get("rasterio_version", "unknown"),
            result.get("pillow_version", "unknown"),
            result["data_dir"],
        )
    else:
        logger.error(
            "Population runtime check failed: %s",
            "; ".join(result["errors"]),
        )

    return result
