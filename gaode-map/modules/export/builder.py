from __future__ import annotations

import hashlib
from datetime import datetime
from io import BytesIO
from typing import Any, Dict, List, Optional, Sequence, Tuple
from zipfile import ZIP_DEFLATED, ZipFile

from modules.h3.arcgis_bridge import run_arcgis_h3_export

from .encoders import (
    build_csv_bytes as _build_csv_bytes,
    build_frontend_chart_files as _build_frontend_chart_files_from_payload,
    build_h3_summary_rows as _build_h3_summary_rows,
    build_poi_category_summary as _build_poi_category_summary,
    build_poi_csv as _build_poi_csv,
    build_summary_rows as _build_summary_rows,
    decode_png_base64 as _decode_png_base64,
    extract_frontend_panel_png as _extract_frontend_panel_png_from_payload,
    pois_to_features as _pois_to_features,
)
from .normalize import (
    encode_json_bytes as _encode_json_bytes,
    json_safe_dict as _json_safe_dict,
    json_safe_value as _json_safe_value,
    normalize_feature as _normalize_feature,
    normalize_feature_list as _normalize_feature_list,
    normalize_poi_rows as _normalize_poi_rows,
)
from .schemas import (
    ALLOWED_EXPORT_PARTS,
    H3_PROFESSIONAL_PARTS,
    AnalysisExportBundleRequest,
)

REQUEST_SIZE_LIMIT_BYTES = 64 * 1024 * 1024
ZIP_SIZE_LIMIT_BYTES = 128 * 1024 * 1024


class AnalysisExportError(RuntimeError):
    pass


class AnalysisExportEmptyError(AnalysisExportError):
    pass


class AnalysisExportOnlyProfessionalFailedError(AnalysisExportError):
    pass


class AnalysisExportTooLargeError(AnalysisExportError):
    pass


class _SkipPartError(RuntimeError):
    pass


_PART_FILE_PATHS: Dict[str, str] = {
    "overview_json": "01_overview/result_overview.json",
    "isochrone_geojson": "02_scope/isochrone.geojson",
    "poi_csv": "03_poi/pois.csv",
    "poi_geojson": "03_poi/pois.geojson",
    "poi_panel_png": "07_panels/poi_panel.png",
    "poi_panel_json": "09_ai/panels/poi_panel.json",
    "h3_grid_geojson": "04_h3/grid.geojson",
    "h3_summary_csv": "04_h3/summary.csv",
    "h3_metrics_json": "04_h3/metrics.json",
    "h3_metric_panel_png": "07_panels/h3_metric_panel.png",
    "h3_structure_panel_png": "07_panels/h3_structure_panel.png",
    "h3_typing_panel_png": "07_panels/h3_typing_panel.png",
    "h3_lq_panel_png": "07_panels/h3_lq_panel.png",
    "h3_gap_panel_png": "07_panels/h3_gap_panel.png",
    "h3_metric_panel_json": "09_ai/panels/h3_metric_panel.json",
    "h3_structure_panel_json": "09_ai/panels/h3_structure_panel.json",
    "h3_typing_panel_json": "09_ai/panels/h3_typing_panel.json",
    "h3_lq_panel_json": "09_ai/panels/h3_lq_panel.json",
    "h3_gap_panel_json": "09_ai/panels/h3_gap_panel.json",
    "road_syntax_geojson": "05_road/roads.geojson",
    "road_syntax_summary_csv": "05_road/summary.csv",
    "road_connectivity_panel_png": "08_road_panels/connectivity_panel.png",
    "road_control_panel_png": "08_road_panels/control_panel.png",
    "road_depth_panel_png": "08_road_panels/depth_panel.png",
    "road_choice_panel_png": "08_road_panels/choice_panel.png",
    "road_integration_panel_png": "08_road_panels/integration_panel.png",
    "road_intelligibility_panel_png": "08_road_panels/intelligibility_panel.png",
    "road_connectivity_panel_json": "09_ai/panels/road_connectivity_panel.json",
    "road_control_panel_json": "09_ai/panels/road_control_panel.json",
    "road_depth_panel_json": "09_ai/panels/road_depth_panel.json",
    "road_choice_panel_json": "09_ai/panels/road_choice_panel.json",
    "road_integration_panel_json": "09_ai/panels/road_integration_panel.json",
    "road_intelligibility_panel_json": "09_ai/panels/road_intelligibility_panel.json",
    "ai_report_json": "09_ai/ai_report.json",
    "ai_facts_json": "09_ai/ai_facts.json",
    "ai_context_md": "09_ai/prompt_context.md",
    "h3_gpkg": "06_h3_professional/h3_analysis.gpkg",
    "h3_arcgis_package": "06_h3_professional/h3_analysis_arcgis_package.zip",
    "map_snapshot_png": "99_assets/map_snapshot.png",
}

_FRONTEND_CHART_FILE_PATHS: Dict[str, str] = {
    "poi_category": "07_charts/poi_category.png",
    "h3_category_distribution": "07_charts/h3_category_distribution.png",
    "h3_density_histogram": "07_charts/h3_density_histogram.png",
    "h3_structure_overview": "07_charts/h3_structure_overview.png",
    "h3_lq_distribution": "07_charts/h3_lq_distribution.png",
    "h3_gap_scatter": "07_charts/h3_gap_scatter.png",
    "road_intelligibility_scatter": "07_charts/road_intelligibility_scatter.png",
}

_FRONTEND_PANEL_PART_TO_ID: Dict[str, str] = {
    "poi_panel_png": "poi_panel",
    "h3_metric_panel_png": "h3_metric_panel",
    "h3_structure_panel_png": "h3_structure_panel",
    "h3_typing_panel_png": "h3_typing_panel",
    "h3_lq_panel_png": "h3_lq_panel",
    "h3_gap_panel_png": "h3_gap_panel",
    "road_connectivity_panel_png": "road_connectivity_panel",
    "road_control_panel_png": "road_control_panel",
    "road_depth_panel_png": "road_depth_panel",
    "road_choice_panel_png": "road_choice_panel",
    "road_integration_panel_png": "road_integration_panel",
    "road_intelligibility_panel_png": "road_intelligibility_panel",
}

_AI_PANEL_PART_META: Dict[str, Dict[str, str]] = {
    "poi_panel_json": {"domain": "poi", "panel_id": "poi_panel"},
    "h3_metric_panel_json": {"domain": "h3", "panel_id": "h3_metric_panel", "focus": "metric"},
    "h3_structure_panel_json": {"domain": "h3", "panel_id": "h3_structure_panel", "focus": "structure"},
    "h3_typing_panel_json": {"domain": "h3", "panel_id": "h3_typing_panel", "focus": "typing"},
    "h3_lq_panel_json": {"domain": "h3", "panel_id": "h3_lq_panel", "focus": "lq"},
    "h3_gap_panel_json": {"domain": "h3", "panel_id": "h3_gap_panel", "focus": "gap"},
    "road_connectivity_panel_json": {"domain": "road", "panel_id": "road_connectivity_panel", "focus": "connectivity"},
    "road_control_panel_json": {"domain": "road", "panel_id": "road_control_panel", "focus": "control"},
    "road_depth_panel_json": {"domain": "road", "panel_id": "road_depth_panel", "focus": "depth"},
    "road_choice_panel_json": {"domain": "road", "panel_id": "road_choice_panel", "focus": "choice"},
    "road_integration_panel_json": {"domain": "road", "panel_id": "road_integration_panel", "focus": "integration"},
    "road_intelligibility_panel_json": {"domain": "road", "panel_id": "road_intelligibility_panel", "focus": "intelligibility"},
}


def _build_frontend_chart_files(payload: AnalysisExportBundleRequest) -> Tuple[List[Tuple[str, bytes]], List[str]]:
    return _build_frontend_chart_files_from_payload(payload.frontend_charts, _FRONTEND_CHART_FILE_PATHS)


def _extract_frontend_panel_png(panel_id: str, payload: AnalysisExportBundleRequest) -> bytes | None:
    return _extract_frontend_panel_png_from_payload(panel_id, payload.frontend_panels)


def estimate_request_size_bytes(payload: AnalysisExportBundleRequest) -> int:
    try:
        return len(payload.model_dump_json().encode("utf-8"))
    except Exception:
        return 0


def build_analysis_export_bundle(payload: AnalysisExportBundleRequest) -> Dict[str, Any]:
    selected_parts = _normalize_selected_parts(payload.parts)
    if not selected_parts:
        raise AnalysisExportEmptyError("No export parts selected")

    generated_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    manifest: Dict[str, Any] = {
        "export_version": "1.0",
        "generated_at": generated_at,
        "template": payload.template,
        "coord_type": payload.coord_type,
        "selected_parts": selected_parts,
        "included_files": [],
        "skipped_parts": [],
        "errors": [],
    }

    professional_selected = [p for p in selected_parts if p in H3_PROFESSIONAL_PARTS]
    professional_selected_only = len(professional_selected) == len(selected_parts)
    professional_failed_parts: set[str] = set()

    zip_buffer = BytesIO()
    with ZipFile(zip_buffer, mode="w", compression=ZIP_DEFLATED) as zf:
        for part in selected_parts:
            try:
                if part == "frontend_charts_png":
                    chart_files, skipped_chart_ids = _build_frontend_chart_files(payload)
                    for chart_id in skipped_chart_ids:
                        manifest["skipped_parts"].append(
                            {
                                "part": part,
                                "chart_id": chart_id,
                                "reason": "missing_or_invalid_chart_png",
                            }
                        )
                    if not chart_files:
                        raise _SkipPartError("empty_frontend_charts")
                    for path, content in chart_files:
                        _write_zip_file(
                            zf,
                            path=path,
                            content=content,
                            record_count=1,
                            included_files=manifest["included_files"],
                        )
                    continue
                if part in _FRONTEND_PANEL_PART_TO_ID:
                    panel_id = _FRONTEND_PANEL_PART_TO_ID[part]
                    panel_png = _extract_frontend_panel_png(panel_id, payload)
                    if not panel_png:
                        manifest["skipped_parts"].append(
                            {
                                "part": part,
                                "panel_id": panel_id,
                                "reason": "missing_or_invalid_panel_png",
                            }
                        )
                        continue
                    _write_zip_file(
                        zf,
                        path=_PART_FILE_PATHS[part],
                        content=panel_png,
                        record_count=1,
                        included_files=manifest["included_files"],
                    )
                    continue
                content, record_count = _build_part_content(part, payload)
                _write_zip_file(
                    zf,
                    path=_PART_FILE_PATHS[part],
                    content=content,
                    record_count=record_count,
                    included_files=manifest["included_files"],
                )
            except _SkipPartError as exc:
                manifest["skipped_parts"].append({"part": part, "reason": str(exc)})
            except Exception as exc:  # noqa: BLE001
                manifest["errors"].append({"part": part, "error": str(exc)})
                if part in H3_PROFESSIONAL_PARTS:
                    professional_failed_parts.add(part)

        manifest_bytes = _encode_json_bytes(manifest)
        _write_zip_file(
            zf,
            path="manifest.json",
            content=manifest_bytes,
            record_count=len(manifest.get("included_files") or []),
            included_files=None,
        )

    included_files = manifest.get("included_files") or []
    if not included_files:
        if professional_selected_only and set(professional_selected) and set(professional_selected).issubset(professional_failed_parts):
            raise AnalysisExportOnlyProfessionalFailedError("Professional exports failed")
        raise AnalysisExportEmptyError("No valid export content generated")

    zip_bytes = zip_buffer.getvalue()
    if len(zip_bytes) > ZIP_SIZE_LIMIT_BYTES:
        raise AnalysisExportTooLargeError(
            f"ZIP payload too large ({len(zip_bytes)} bytes > {ZIP_SIZE_LIMIT_BYTES} bytes)"
        )

    filename = f"analysis_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return {
        "filename": filename,
        "content": zip_bytes,
        "manifest": manifest,
    }


def _normalize_selected_parts(parts: Sequence[str]) -> List[str]:
    allowed = set(ALLOWED_EXPORT_PARTS)
    result: List[str] = []
    for part in parts or []:
        key = str(part or "").strip()
        if not key or key not in allowed:
            continue
        if key in result:
            continue
        result.append(key)
    return result


def _write_zip_file(
    zf: ZipFile,
    *,
    path: str,
    content: bytes,
    record_count: int,
    included_files: Optional[List[Dict[str, Any]]],
) -> None:
    data = bytes(content or b"")
    zf.writestr(path, data)
    if included_files is not None:
        included_files.append(
            {
                "file": path,
                "size_bytes": len(data),
                "record_count": max(0, int(record_count)),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )


def _build_part_content(part: str, payload: AnalysisExportBundleRequest) -> Tuple[bytes, int]:
    if part == "overview_json":
        overview = _build_overview_payload(payload)
        return _encode_json_bytes(overview), 1

    if part == "isochrone_geojson":
        feature = _normalize_feature(payload.isochrone_feature)
        if not feature:
            raise _SkipPartError("missing_or_invalid_isochrone_feature")
        return _encode_json_bytes(feature), 1

    if part == "poi_csv":
        poi_rows = _normalize_poi_rows(payload.pois)
        if not poi_rows:
            raise _SkipPartError("empty_poi_list")
        return _build_poi_csv(poi_rows), len(poi_rows)

    if part == "poi_geojson":
        poi_rows = _normalize_poi_rows(payload.pois)
        if not poi_rows:
            raise _SkipPartError("empty_poi_list")
        geojson = {
            "type": "FeatureCollection",
            "features": _pois_to_features(poi_rows),
            "count": len(poi_rows),
        }
        return _encode_json_bytes(geojson), len(poi_rows)

    if part == "frontend_charts_png":
        chart_files, _ = _build_frontend_chart_files(payload)
        if not chart_files:
            raise _SkipPartError("empty_frontend_charts")
        return b"", len(chart_files)

    if part in _FRONTEND_PANEL_PART_TO_ID:
        panel_id = _FRONTEND_PANEL_PART_TO_ID[part]
        panel_png = _extract_frontend_panel_png(panel_id, payload)
        if not panel_png:
            raise _SkipPartError("missing_or_invalid_panel_png")
        return panel_png, 1

    if part == "h3_grid_geojson":
        features = _extract_h3_grid_features(payload)
        if not features:
            raise _SkipPartError("empty_h3_grid")
        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "count": len(features),
        }
        return _encode_json_bytes(geojson), len(features)

    if part == "h3_summary_csv":
        features = _extract_h3_grid_features(payload)
        if not features:
            raise _SkipPartError("empty_h3_grid")
        rows = _build_h3_summary_rows(features)
        if not rows:
            raise _SkipPartError("empty_h3_summary_rows")
        return _build_csv_bytes(rows, headers=list(rows[0].keys())), len(rows)

    if part == "h3_metrics_json":
        h3_payload = payload.h3
        if not h3_payload:
            raise _SkipPartError("missing_h3_payload")
        features = _extract_h3_grid_features(payload)
        if not features and not h3_payload.summary and not h3_payload.charts:
            raise _SkipPartError("empty_h3_metrics_payload")
        metrics = {
            "summary": _json_safe_value(h3_payload.summary),
            "charts": _json_safe_value(h3_payload.charts),
            "style_meta": _json_safe_value(h3_payload.style_meta),
            "grid_count": len(features),
        }
        return _encode_json_bytes(metrics), max(1, len(features))

    if part == "road_syntax_geojson":
        features = _extract_road_features(payload)
        if not features:
            raise _SkipPartError("empty_road_syntax_features")
        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "count": len(features),
        }
        return _encode_json_bytes(geojson), len(features)

    if part == "road_syntax_summary_csv":
        summary = (payload.road_syntax.summary if payload.road_syntax else {}) or {}
        rows = _build_summary_rows(summary)
        if not rows:
            raise _SkipPartError("empty_road_syntax_summary")
        return _build_csv_bytes(rows, headers=["key", "value"]), len(rows)

    if part in _AI_PANEL_PART_META:
        panel_payload = _build_ai_panel_payload(part, payload)
        return _encode_json_bytes(panel_payload), 1

    if part == "ai_report_json":
        report = _build_ai_report_payload(payload)
        return _encode_json_bytes(report), 1

    if part == "ai_facts_json":
        facts = _build_ai_facts_payload(payload)
        return _encode_json_bytes(facts), 1

    if part == "ai_context_md":
        text = _build_ai_context_markdown(payload)
        return text.encode("utf-8"), max(1, len(text.splitlines()))

    if part == "map_snapshot_png":
        png_bytes = _decode_png_base64(payload.map_snapshot_png_base64)
        if not png_bytes:
            raise _SkipPartError("missing_map_snapshot_png")
        return png_bytes, 1

    if part in {"h3_gpkg", "h3_arcgis_package"}:
        return _build_h3_professional_export(part, payload)

    raise _SkipPartError("unsupported_part")


def _build_overview_payload(payload: AnalysisExportBundleRequest) -> Dict[str, Any]:
    poi_rows = _normalize_poi_rows(payload.pois)
    h3_features = _extract_h3_grid_features(payload)
    road_features = _extract_road_features(payload)
    return {
        "context": _json_safe_value(payload.context),
        "coord_type": payload.coord_type,
        "counts": {
            "pois": len(poi_rows),
            "h3_grid_features": len(h3_features),
            "road_features": len(road_features),
            "has_isochrone": _normalize_feature(payload.isochrone_feature) is not None,
            "has_h3_summary": bool(payload.h3 and payload.h3.summary),
            "has_road_summary": bool(payload.road_syntax and payload.road_syntax.summary),
        },
    }


def _build_ai_panel_payload(part: str, payload: AnalysisExportBundleRequest) -> Dict[str, Any]:
    meta = _AI_PANEL_PART_META.get(part) or {}
    domain = str(meta.get("domain") or "").strip()
    panel_id = str(meta.get("panel_id") or "").strip()
    focus = str(meta.get("focus") or "").strip()
    analysis = _json_safe_dict(payload.frontend_analysis)
    context = _json_safe_value(payload.context)

    poi_rows = _normalize_poi_rows(payload.pois)
    h3_features = _extract_h3_grid_features(payload)
    road_features = _extract_road_features(payload)

    body: Dict[str, Any] = {
        "part": part,
        "panel_id": panel_id,
        "domain": domain,
        "focus": focus,
        "coord_type": payload.coord_type,
        "context": context,
    }

    if domain == "poi":
        data = {
            "poi_count": len(poi_rows),
            "category_summary": _build_poi_category_summary(poi_rows),
            "analysis": _json_safe_dict(analysis.get("poi")),
        }
        if not data["poi_count"] and not data["analysis"]:
            raise _SkipPartError("empty_ai_poi_panel")
        body["data"] = data
        return body

    if domain == "h3":
        h3_payload = payload.h3
        h3_summary = _json_safe_dict((h3_payload.summary if h3_payload else {}) or {})
        h3_charts = _json_safe_dict((h3_payload.charts if h3_payload else {}) or {})
        data = {
            "grid_count": len(h3_features),
            "summary": h3_summary,
            "charts": h3_charts,
            "analysis": _json_safe_dict(analysis.get("h3")),
        }
        if not data["grid_count"] and not data["summary"] and not data["analysis"]:
            raise _SkipPartError("empty_ai_h3_panel")
        body["data"] = data
        return body

    if domain == "road":
        road_payload = payload.road_syntax
        road_summary = _json_safe_dict((road_payload.summary if road_payload else {}) or {})
        data = {
            "feature_count": len(road_features),
            "summary": road_summary,
            "analysis": _json_safe_dict(analysis.get("road")),
        }
        if not data["feature_count"] and not data["summary"] and not data["analysis"]:
            raise _SkipPartError("empty_ai_road_panel")
        body["data"] = data
        return body

    raise _SkipPartError("unknown_ai_panel")


def _build_ai_report_payload(payload: AnalysisExportBundleRequest) -> Dict[str, Any]:
    poi_rows = _normalize_poi_rows(payload.pois)
    h3_features = _extract_h3_grid_features(payload)
    road_features = _extract_road_features(payload)
    ai_facts = _build_ai_facts_payload(payload)
    analysis = _json_safe_dict(payload.frontend_analysis)

    poi_category_summary = _build_poi_category_summary(poi_rows)
    poi_analysis = _json_safe_dict(analysis.get("poi"))
    h3_analysis = _json_safe_dict(analysis.get("h3"))
    road_analysis = _json_safe_dict(analysis.get("road"))

    return {
        "meta": {
            "template": payload.template,
            "coord_type": payload.coord_type,
            "context": _json_safe_value(payload.context),
        },
        "scope": {
            "isochrone_present": _normalize_feature(payload.isochrone_feature) is not None,
            "isochrone_geometry_type": _extract_feature_geometry_type(payload.isochrone_feature),
        },
        "poi": {
            "count": len(poi_rows),
            "category_summary": poi_category_summary,
            "analysis": poi_analysis,
        },
        "h3": {
            "grid_count": len(h3_features),
            "summary": _json_safe_value((payload.h3.summary if payload.h3 else {}) or {}),
            "charts": _json_safe_value((payload.h3.charts if payload.h3 else {}) or {}),
            "analysis": h3_analysis,
        },
        "road": {
            "feature_count": len(road_features),
            "summary": _json_safe_value((payload.road_syntax.summary if payload.road_syntax else {}) or {}),
            "analysis": road_analysis,
        },
        "facts": ai_facts,
        "limits": [
            "该结果仅反映空间结构与供给分布，不直接代表人口、客流、消费能力和经营结果。",
            "指标受等时圈参数、POI数据源、采样策略和图模型设置影响，应结合业务知识解释。",
        ],
    }


def _build_ai_facts_payload(payload: AnalysisExportBundleRequest) -> Dict[str, Any]:
    poi_rows = _normalize_poi_rows(payload.pois)
    h3_features = _extract_h3_grid_features(payload)
    road_features = _extract_road_features(payload)
    h3_summary = _json_safe_dict((payload.h3.summary if payload.h3 else {}) or {})
    road_summary = _json_safe_dict((payload.road_syntax.summary if payload.road_syntax else {}) or {})

    return {
        "poi_total": len(poi_rows),
        "h3_grid_count": len(h3_features),
        "road_feature_count": len(road_features),
        "road_node_count": _pick_first_numeric(
            road_summary,
            ["node_count", "nodes_count", "road_node_count", "nodes_total", "node_total"],
        ),
        "road_total_length_km": _pick_first_numeric(
            road_summary,
            ["total_length_km", "road_length_km", "length_km", "total_km"],
        ),
        "h3_avg_density_poi_per_km2": _pick_first_numeric(
            h3_summary,
            ["avg_density_poi_per_km2", "average_density_poi_per_km2", "avg_density"],
        ),
        "global_moran_i": _pick_first_numeric(
            h3_summary,
            ["global_moran_i_density", "global_moran_i", "moran_i"],
        ),
        "global_moran_z_score": _pick_first_numeric(
            h3_summary,
            ["global_moran_z_score", "moran_z_score", "global_moran_z"],
        ),
        "avg_local_entropy": _pick_first_numeric(
            h3_summary,
            ["avg_local_entropy", "average_local_entropy", "avg_entropy"],
        ),
        "avg_road_integration": _pick_first_numeric(
            road_summary,
            ["avg_integration", "integration_mean", "mean_integration"],
        ),
        "avg_road_connectivity": _pick_first_numeric(
            road_summary,
            ["avg_connectivity", "connectivity_mean", "mean_connectivity"],
        ),
        "road_intelligibility": _pick_first_numeric(
            road_summary,
            ["intelligibility", "intelligibility_r", "road_intelligibility"],
        ),
        "road_intelligibility_r2": _pick_first_numeric(
            road_summary,
            ["intelligibility_r2", "intelligibility_rsquared", "road_intelligibility_r2"],
        ),
    }


def _build_ai_context_markdown(payload: AnalysisExportBundleRequest) -> str:
    context = _json_safe_dict(payload.context)
    mode = str(context.get("mode") or "")
    time_min = context.get("time_min")
    source = str(context.get("source") or "")
    coord_type = payload.coord_type

    lines = [
        "# AI 分析口径说明",
        "",
        "## 数据来源",
        f"- template: `{payload.template}`",
        f"- coord_type: `{coord_type}`",
        f"- mode: `{mode}`",
        f"- time_min: `{time_min}`",
        f"- source: `{source}`",
        "",
        "## 建议任务",
        "- 优先基于 `ai_facts.json` 提取关键结论，再结合 `ai_report.json` 分章节解释。",
        "- 所有结论需引用对应字段，不要把推测写成事实。",
        "",
        "## 解释边界",
        "- 本数据不能直接推断人口规模、客流强度、消费能力和经营收益。",
        "- 若字段缺失或为空，请明确标注“数据不足”。",
        "",
    ]
    return "\n".join(lines)


def _pick_first_numeric(source: Dict[str, Any], keys: Sequence[str]) -> Optional[float]:
    if not isinstance(source, dict):
        return None
    for key in keys:
        value = source.get(key)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if number == number:
            return number
    return None


def _extract_feature_geometry_type(feature: Any) -> str:
    normalized = _normalize_feature(feature)
    if not normalized:
        return ""
    geometry = normalized.get("geometry") if isinstance(normalized, dict) else {}
    if not isinstance(geometry, dict):
        return ""
    return str(geometry.get("type") or "")


def _build_h3_professional_export(part: str, payload: AnalysisExportBundleRequest) -> Tuple[bytes, int]:
    h3_payload = payload.h3
    if not h3_payload:
        raise _SkipPartError("missing_h3_payload")

    grid_features = _extract_h3_grid_features(payload)
    if not grid_features:
        raise _SkipPartError("empty_h3_grid")

    poi_rows = _normalize_poi_rows(payload.pois)
    poi_features = _pois_to_features(poi_rows)
    style_mode = _resolve_h3_style_mode(h3_payload.style_meta)
    export_format = "gpkg" if part == "h3_gpkg" else "arcgis_package"

    export_result = run_arcgis_h3_export(
        export_format=export_format,
        include_poi=bool(poi_features),
        style_mode=style_mode,
        grid_features=grid_features,
        poi_features=poi_features,
        style_meta=_json_safe_dict(h3_payload.style_meta),
        timeout_sec=300,
    )
    content = export_result.get("content") or b""
    if not isinstance(content, (bytes, bytearray)) or not content:
        raise RuntimeError("ArcGIS export returned empty content")

    return bytes(content), len(grid_features)


def _resolve_h3_style_mode(style_meta: Dict[str, Any]) -> str:
    mode = ""
    if isinstance(style_meta, dict):
        mode = str(style_meta.get("style_mode") or "").strip().lower()
        if mode not in {"density", "gi_z", "lisa_i"}:
            mode = str(style_meta.get("structure_fill_mode") or "").strip().lower()
    if mode not in {"density", "gi_z", "lisa_i"}:
        mode = "density"
    return mode


def _extract_h3_grid_features(payload: AnalysisExportBundleRequest) -> List[Dict[str, Any]]:
    source = payload.h3.grid_features if payload.h3 else []
    return _normalize_feature_list(source, allowed_geometry_types={"Polygon", "MultiPolygon"})


def _extract_road_features(payload: AnalysisExportBundleRequest) -> List[Dict[str, Any]]:
    roads = payload.road_syntax.roads if payload.road_syntax else {}
    features: List[Dict[str, Any]] = []
    if isinstance(roads, dict):
        candidates = roads.get("features") if isinstance(roads.get("features"), list) else []
        features = _normalize_feature_list(candidates, allowed_geometry_types={"LineString", "MultiLineString"})
    return features
