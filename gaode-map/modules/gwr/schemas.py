from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class GwrPoiLike(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Optional[str] = None
    name: Optional[str] = None
    location: Optional[List[float]] = Field(None, min_length=2, max_length=2)
    lng: Optional[float] = None
    lat: Optional[float] = None
    type: Optional[str] = None


class GwrRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    polygon: list = Field(..., description="Polygon ring or multi-ring polygon coordinates")
    coord_type: Literal["gcj02", "wgs84"] = Field("gcj02")
    population_year: str = Field("2026")
    nightlight_year: Optional[int] = Field(None)
    pois: List[GwrPoiLike] = Field(default_factory=list)
    poi_coord_type: Literal["gcj02", "wgs84"] = Field("gcj02")
    road_features: List[Dict[str, Any]] = Field(default_factory=list)
    arcgis_timeout_sec: int = Field(240, ge=30, le=1800)


class GwrVariable(BaseModel):
    key: str
    label: str
    unit: str = ""


class GwrSummary(BaseModel):
    ok: bool = False
    status: str = ""
    engine: str = "local"
    sample_count: int = 0
    cell_count: int = 0
    variable_count: int = 0
    r2: Optional[float] = None
    adjusted_r2: Optional[float] = None
    mean_abs_residual: float = 0.0
    rmse: float = 0.0
    top_variables: List[Dict[str, Any]] = Field(default_factory=list)


class GwrCell(BaseModel):
    cell_id: str
    observed: Optional[float] = None
    predicted: Optional[float] = None
    residual: Optional[float] = None
    local_r2: Optional[float] = None
    coefficients: Dict[str, float] = Field(default_factory=dict)
    predictors: Dict[str, float] = Field(default_factory=dict)


class GwrResponse(BaseModel):
    summary: GwrSummary
    variables: List[GwrVariable] = Field(default_factory=list)
    cells: List[GwrCell] = Field(default_factory=list)
    feature_collection: Dict[str, Any] = Field(default_factory=dict)
    diagnostics: Dict[str, Any] = Field(default_factory=dict)
    engine_status: str = ""
