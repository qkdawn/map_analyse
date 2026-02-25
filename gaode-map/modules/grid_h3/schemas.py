from typing import Any, Dict, List, Literal
from pydantic import BaseModel, Field


class GridRequest(BaseModel):
    polygon: List[List[float]] = Field(
        ...,
        min_length=3,
        description="Polygon ring coordinates ([[lng, lat], ...])",
    )
    resolution: int = Field(9, ge=0, le=15, description="H3 resolution")
    coord_type: Literal["gcj02", "wgs84"] = Field(
        "gcj02",
        description="Input coordinate system",
    )
    include_mode: Literal["intersects", "inside"] = Field(
        "intersects",
        description="Grid include strategy against source polygon",
    )
    min_overlap_ratio: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Minimum overlap ratio (0~1), used when include_mode=intersects",
    )


class GridFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    properties: Dict[str, Any]
    geometry: Dict[str, Any]


class GridResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GridFeature] = Field(default_factory=list)
    count: int = Field(0, ge=0)
