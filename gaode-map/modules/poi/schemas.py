from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class PoiRequest(BaseModel):
    polygon: list = Field(..., description="Polygon or multi-ring polygon payload (GCJ02)")
    keywords: str = Field(..., description="Search keywords, e.g. 'KFC|Starbucks'")
    types: str = Field(default="", description="POI Types code, optional")
    source: Literal["gaode", "local"] = Field(default="local", description="POI source")
    year: Optional[int] = Field(default=None, description="Year filter for local source")
    max_count: int = Field(default=1000, description="Max number of POIs to return (to prevent abuse)")
    
    # History Context
    save_history: bool = Field(default=False, description="Whether to save the result to history")
    center: Optional[List[float]] = Field(None, description="Center point (GCJ02) [lng, lat]")
    time_min: Optional[int] = Field(None, description="Isochrone time")
    location_name: Optional[str] = Field(None, description="Name of the center location")
    mode: Optional[str] = Field("walking", description="Transport mode: walking, cycling, driving")

class PoiPoint(BaseModel):
    id: str
    name: str
    location: List[float] = Field(..., description="[lng, lat]")
    address: Optional[str] = None
    type: Optional[str] = None
    adname: Optional[str] = None
    year: Optional[int] = None
    lines: Optional[List[str]] = []

class PoiResponse(BaseModel):
    pois: List[PoiPoint]
    count: int


class HistorySaveRequest(BaseModel):
    history_id: Optional[str] = Field(
        default=None,
        description="Existing history id to reuse when resaving a restored history",
    )
    center: List[float] = Field(..., description="Center [lng, lat] (GCJ02)")
    polygon: list = Field(..., description="Polygon coordinates (GCJ02)") # Relaxed type to handle MultiPolygon if needed
    polygon_wgs84: Optional[list] = Field(
        default=None,
        description="Original history polygon coordinates (WGS84) preserved across restore/save",
    )
    drawn_polygon: Optional[List[List[float]]] = Field(
        default=None,
        description="Optional user-drawn polygon ring (GCJ02)"
    )
    pois: List[dict] = Field(..., description="List of POI objects")
    keywords: str = Field(default="")
    mode: str = Field(default="walking")
    time_min: int = Field(default=15)
    year: Optional[int] = Field(None, description="POI data year")
    location_name: Optional[str] = Field(None, description="Location name or coordinates for title")
    source: Optional[Literal["gaode", "local"]] = Field(default="local", description="POI source for this analysis")
    h3_result: Optional[dict] = Field(
        default=None,
        description="Deprecated snapshot payload field; accepted for compatibility and ignored on save",
    )
    road_result: Optional[dict] = Field(
        default=None,
        description="Deprecated snapshot payload field; accepted for compatibility and ignored on save",
    )
