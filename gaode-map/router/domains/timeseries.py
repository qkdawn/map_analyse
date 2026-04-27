from __future__ import annotations

from fastapi import APIRouter, HTTPException

from modules.timeseries.schemas import (
    TimeseriesJointRequest,
    TimeseriesMetaResponse,
    TimeseriesNightlightRequest,
    TimeseriesPopulationRequest,
    TimeseriesResponse,
)
from modules.timeseries.service import (
    get_timeseries_joint,
    get_timeseries_meta,
    get_timeseries_nightlight,
    get_timeseries_population,
)

router = APIRouter()


@router.get("/api/v1/analysis/timeseries/meta", response_model=TimeseriesMetaResponse)
async def timeseries_meta():
    return get_timeseries_meta()


@router.post("/api/v1/analysis/timeseries/population", response_model=TimeseriesResponse)
async def timeseries_population(payload: TimeseriesPopulationRequest):
    try:
        return get_timeseries_population(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            period=payload.period,
            layer_view=payload.layer_view,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/timeseries/nightlight", response_model=TimeseriesResponse)
async def timeseries_nightlight(payload: TimeseriesNightlightRequest):
    try:
        return get_timeseries_nightlight(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            period=payload.period,
            layer_view=payload.layer_view,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/analysis/timeseries/joint", response_model=TimeseriesResponse)
async def timeseries_joint(payload: TimeseriesJointRequest):
    try:
        return get_timeseries_joint(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            period=payload.period,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
