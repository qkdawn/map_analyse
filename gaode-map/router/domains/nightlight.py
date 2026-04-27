from __future__ import annotations

from fastapi import APIRouter, HTTPException

from modules.nightlight.schemas import (
    NightlightGridRequest,
    NightlightGridResponse,
    NightlightLayerRequest,
    NightlightLayerResponse,
    NightlightMetaResponse,
    NightlightOverviewRequest,
    NightlightOverviewResponse,
    NightlightRasterRequest,
    NightlightRasterResponse,
)
from modules.nightlight.service import (
    build_nightlight_meta_payload,
    get_nightlight_grid,
    get_nightlight_layer,
    get_nightlight_overview,
    get_nightlight_raster_preview,
)

router = APIRouter()


@router.get("/api/v1/analysis/nightlight/meta", response_model=NightlightMetaResponse)
async def nightlight_meta():
    return build_nightlight_meta_payload()


@router.post("/api/v1/analysis/nightlight/overview", response_model=NightlightOverviewResponse)
async def nightlight_overview(payload: NightlightOverviewRequest):
    try:
        return get_nightlight_overview(payload.polygon, payload.coord_type, payload.year)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/nightlight/grid", response_model=NightlightGridResponse)
async def nightlight_grid(payload: NightlightGridRequest):
    try:
        return get_nightlight_grid(payload.polygon, payload.coord_type, payload.year)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/nightlight/layer", response_model=NightlightLayerResponse)
async def nightlight_layer(payload: NightlightLayerRequest):
    try:
        return get_nightlight_layer(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            scope_id=payload.scope_id,
            year=payload.year,
            view=payload.view,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/nightlight/raster", response_model=NightlightRasterResponse)
async def nightlight_raster(payload: NightlightRasterRequest):
    try:
        return get_nightlight_raster_preview(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            scope_id=payload.scope_id,
            year=payload.year,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
