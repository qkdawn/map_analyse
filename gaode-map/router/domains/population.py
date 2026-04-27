from __future__ import annotations

from fastapi import APIRouter, HTTPException

from modules.population.schemas import (
    PopulationGridRequest,
    PopulationGridResponse,
    PopulationLayerRequest,
    PopulationLayerResponse,
    PopulationMetaResponse,
    PopulationOverviewRequest,
    PopulationOverviewResponse,
    PopulationRasterRequest,
    PopulationRasterResponse,
)
from modules.population.service import (
    build_population_meta_payload,
    get_population_grid,
    get_population_layer,
    get_population_overview,
    get_population_raster_preview,
)

router = APIRouter()


@router.get("/api/v1/analysis/population/meta", response_model=PopulationMetaResponse)
async def population_meta():
    return build_population_meta_payload()


@router.post("/api/v1/analysis/population/overview", response_model=PopulationOverviewResponse)
async def population_overview(payload: PopulationOverviewRequest):
    try:
        return get_population_overview(payload.polygon, payload.coord_type, payload.year)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/population/grid", response_model=PopulationGridResponse)
async def population_grid(payload: PopulationGridRequest):
    try:
        return get_population_grid(payload.polygon, payload.coord_type, payload.year)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/population/layer", response_model=PopulationLayerResponse)
async def population_layer(payload: PopulationLayerRequest):
    try:
        return get_population_layer(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            year=payload.year,
            scope_id=payload.scope_id,
            view=payload.view,
            sex_mode=payload.sex_mode,
            age_mode=payload.age_mode,
            age_band=payload.age_band,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/population/raster", response_model=PopulationRasterResponse)
async def population_raster(payload: PopulationRasterRequest):
    try:
        return get_population_raster_preview(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            year=payload.year,
            sex=payload.sex,
            age_band=payload.age_band,
            scope_id=payload.scope_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
