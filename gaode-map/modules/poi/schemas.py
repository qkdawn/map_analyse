from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class PoiRequest(BaseModel):
    polygon: List[List[float]] = Field(..., description="Polygon (GCJ02) as [[lng, lat], [lng, lat], ...]")
    keywords: str = Field(..., description="Search keywords, e.g. 'KFC|Starbucks'")
    types: str = Field(default="", description="POI Types code, optional")
    source: Literal["gaode", "local"] = Field(default="gaode", description="POI source")
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
    lines: Optional[List[str]] = []

class PoiResponse(BaseModel):
    pois: List[PoiPoint]
    count: int


class HistorySaveRequest(BaseModel):
    center: List[float] = Field(..., description="Center [lng, lat] (GCJ02)")
    polygon: list = Field(..., description="Polygon coordinates (GCJ02)") # Relaxed type to handle MultiPolygon if needed
    pois: List[dict] = Field(..., description="List of POI objects")
    keywords: str = Field(default="")
    mode: str = Field(default="walking")
    time_min: int = Field(default=15)
    location_name: Optional[str] = Field(None, description="Location name or coordinates for title")
