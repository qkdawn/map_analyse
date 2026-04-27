from __future__ import annotations

from fastapi import APIRouter, HTTPException

from modules.gwr.schemas import GwrRequest, GwrResponse
from modules.gwr.service import analyze_nightlight_gwr

router = APIRouter()


@router.post("/api/v1/analysis/gwr", response_model=GwrResponse)
async def gwr_analysis(payload: GwrRequest):
    try:
        return analyze_nightlight_gwr(
            polygon=payload.polygon,
            coord_type=payload.coord_type,
            population_year=payload.population_year,
            nightlight_year=payload.nightlight_year,
            pois=[item.model_dump() for item in payload.pois],
            poi_coord_type=payload.poi_coord_type,
            road_features=payload.road_features,
            arcgis_timeout_sec=payload.arcgis_timeout_sec,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
