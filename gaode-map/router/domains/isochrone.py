from fastapi import APIRouter, HTTPException
from modules.isochrone.service import build_debug_isochrone_samples, calculate_isochrone_feature
from modules.isochrone.schemas import (
    IsochroneDebugSampleRequest,
    IsochroneDebugSampleResponse,
    IsochroneRequest,
    IsochroneResponse,
)

router = APIRouter()


@router.post("/api/v1/analysis/isochrone", response_model=IsochroneResponse)
async def calculate_isochrone(payload: IsochroneRequest):
    try:
        return await calculate_isochrone_feature(payload)
    except HTTPException:
        raise


@router.post("/api/v1/analysis/isochrone/debug-samples", response_model=IsochroneDebugSampleResponse)
async def debug_isochrone_samples(payload: IsochroneDebugSampleRequest):
    try:
        return await build_debug_isochrone_samples(payload)
    except HTTPException:
        raise
