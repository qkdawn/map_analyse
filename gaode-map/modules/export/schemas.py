from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ExportPart = Literal[
    "overview_json",
    "isochrone_geojson",
    "poi_csv",
    "poi_geojson",
    "poi_panel_png",
    "poi_panel_json",
    "frontend_charts_png",
    "h3_grid_geojson",
    "h3_summary_csv",
    "h3_metrics_json",
    "h3_metric_panel_png",
    "h3_structure_panel_png",
    "h3_typing_panel_png",
    "h3_lq_panel_png",
    "h3_gap_panel_png",
    "h3_metric_panel_json",
    "h3_structure_panel_json",
    "h3_typing_panel_json",
    "h3_lq_panel_json",
    "h3_gap_panel_json",
    "road_syntax_geojson",
    "road_syntax_summary_csv",
    "road_connectivity_panel_png",
    "road_control_panel_png",
    "road_depth_panel_png",
    "road_choice_panel_png",
    "road_integration_panel_png",
    "road_intelligibility_panel_png",
    "road_connectivity_panel_json",
    "road_control_panel_json",
    "road_depth_panel_json",
    "road_choice_panel_json",
    "road_integration_panel_json",
    "road_intelligibility_panel_json",
    "ai_report_json",
    "ai_facts_json",
    "ai_context_md",
    "map_snapshot_png",
    "h3_gpkg",
    "h3_arcgis_package",
]

ALLOWED_EXPORT_PARTS: tuple[str, ...] = (
    "overview_json",
    "isochrone_geojson",
    "poi_csv",
    "poi_geojson",
    "poi_panel_png",
    "poi_panel_json",
    "frontend_charts_png",
    "h3_grid_geojson",
    "h3_summary_csv",
    "h3_metrics_json",
    "h3_metric_panel_png",
    "h3_structure_panel_png",
    "h3_typing_panel_png",
    "h3_lq_panel_png",
    "h3_gap_panel_png",
    "h3_metric_panel_json",
    "h3_structure_panel_json",
    "h3_typing_panel_json",
    "h3_lq_panel_json",
    "h3_gap_panel_json",
    "road_syntax_geojson",
    "road_syntax_summary_csv",
    "road_connectivity_panel_png",
    "road_control_panel_png",
    "road_depth_panel_png",
    "road_choice_panel_png",
    "road_integration_panel_png",
    "road_intelligibility_panel_png",
    "road_connectivity_panel_json",
    "road_control_panel_json",
    "road_depth_panel_json",
    "road_choice_panel_json",
    "road_integration_panel_json",
    "road_intelligibility_panel_json",
    "ai_report_json",
    "ai_facts_json",
    "ai_context_md",
    "map_snapshot_png",
    "h3_gpkg",
    "h3_arcgis_package",
)

H3_PROFESSIONAL_PARTS: tuple[str, ...] = (
    "h3_gpkg",
    "h3_arcgis_package",
)


class AnalysisExportH3Payload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    grid_features: List[Dict[str, Any]] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
    charts: Dict[str, Any] = Field(default_factory=dict)
    style_meta: Dict[str, Any] = Field(default_factory=dict)


class AnalysisExportRoadSyntaxPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    roads: Dict[str, Any] = Field(default_factory=dict)
    summary: Dict[str, Any] = Field(default_factory=dict)
    nodes: Dict[str, Any] = Field(default_factory=dict)
    diagnostics: Dict[str, Any] = Field(default_factory=dict)


class AnalysisExportFrontendChartPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    chart_id: str = ""
    png_base64: Optional[str] = None


class AnalysisExportFrontendPanelPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    panel_id: str = ""
    png_base64: Optional[str] = None


class AnalysisExportBundleRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    template: Literal["business_common"] = "business_common"
    parts: List[ExportPart] = Field(default_factory=list)
    coord_type: Literal["gcj02", "wgs84"] = "gcj02"
    context: Dict[str, Any] = Field(default_factory=dict)
    isochrone_feature: Optional[Dict[str, Any]] = None
    pois: List[Dict[str, Any]] = Field(default_factory=list)
    h3: Optional[AnalysisExportH3Payload] = None
    road_syntax: Optional[AnalysisExportRoadSyntaxPayload] = None
    frontend_charts: List[AnalysisExportFrontendChartPayload] = Field(default_factory=list)
    frontend_panels: List[AnalysisExportFrontendPanelPayload] = Field(default_factory=list)
    frontend_analysis: Dict[str, Any] = Field(default_factory=dict)
    map_snapshot_png_base64: Optional[str] = None
