from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class H3Row(BaseModel):
    h3_id: str
    value: float = 0.0
    ring: List[List[float]] = Field(default_factory=list)


class ArcGISH3AnalyzeRequest(BaseModel):
    rows: List[H3Row] = Field(default_factory=list)
    knn_neighbors: int = Field(8, ge=1, le=64)
    export_image: bool = True
    timeout_sec: int = Field(240, ge=30, le=1800)
    run_id: Optional[str] = None
    arcgis_python_path: Optional[str] = None


class GlobalMoranOut(BaseModel):
    i: Optional[float] = None
    z_score: Optional[float] = None


class ArcGISCellOut(BaseModel):
    h3_id: str
    gi_z_score: Optional[float] = None
    lisa_i: Optional[float] = None
    lisa_z_score: Optional[float] = None


class ArcGISH3AnalyzeResponse(BaseModel):
    ok: bool = True
    status: str = "ok"
    cells: List[ArcGISCellOut] = Field(default_factory=list)
    global_moran: GlobalMoranOut = Field(default_factory=GlobalMoranOut)
    preview_svg: Optional[str] = None
    error: Optional[str] = None
    trace_id: str


class ArcGISH3ExportRequest(BaseModel):
    format: Literal["gpkg", "arcgis_package"] = "gpkg"
    include_poi: bool = True
    style_mode: Literal["density", "gi_z", "lisa_i"] = "density"
    grid_features: List[Dict[str, Any]] = Field(default_factory=list)
    poi_features: List[Dict[str, Any]] = Field(default_factory=list)
    style_meta: Dict[str, Any] = Field(default_factory=dict)
    timeout_sec: int = Field(300, ge=30, le=3600)
    run_id: Optional[str] = None
    arcgis_python_path: Optional[str] = None


class ArcGISRoadSyntaxWebGLRequest(BaseModel):
    roads_features: List[Dict[str, Any]] = Field(default_factory=list)
    metric_field: str = "accessibility_score"
    target_coord_type: Literal["gcj02", "wgs84"] = "gcj02"
    timeout_sec: int = Field(300, ge=5, le=3600)
    run_id: Optional[str] = None
    arcgis_python_path: Optional[str] = None


class ArcGISRoadSyntaxWebGLResponse(BaseModel):
    ok: bool = True
    status: str = "ok"
    metric_field: str = "accessibility_score"
    coord_type: Literal["gcj02", "wgs84"] = "gcj02"
    roads: Dict[str, Any] = Field(
        default_factory=lambda: {"type": "FeatureCollection", "features": [], "count": 0}
    )
    elapsed_ms: float = 0.0
    error: Optional[str] = None
    trace_id: str
