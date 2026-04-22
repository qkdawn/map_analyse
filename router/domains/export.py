import asyncio

from fastapi import APIRouter, HTTPException, Request, Response

from modules.h3.arcgis_bridge import run_arcgis_h3_export
from modules.export import (
    AnalysisExportBundleRequest,
    AnalysisExportEmptyError,
    AnalysisExportOnlyProfessionalFailedError,
    AnalysisExportTooLargeError,
    REQUEST_SIZE_LIMIT_BYTES,
    build_analysis_export_bundle,
    estimate_request_size_bytes,
)
from modules.h3.analysis_schemas import H3ExportRequest

router = APIRouter()


@router.post("/api/v1/analysis/h3/export")
async def export_h3_analysis(payload: H3ExportRequest):
    try:
        export_result = await asyncio.to_thread(
            run_arcgis_h3_export,
            export_format=payload.format,
            include_poi=payload.include_poi,
            style_mode=payload.style_mode,
            grid_features=[
                feature.model_dump() if hasattr(feature, "model_dump") else feature
                for feature in (payload.grid_features or [])
            ],
            poi_features=[
                feature.model_dump() if hasattr(feature, "model_dump") else feature
                for feature in (payload.poi_features or [])
            ],
            style_meta=payload.style_meta,
            timeout_sec=payload.arcgis_timeout_sec,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=f"ArcGIS导出失败: {exc}") from exc

    filename = str(export_result.get("filename") or "h3_analysis_export.bin")
    content_type = str(export_result.get("content_type") or "application/octet-stream")
    content = export_result.get("content") or b""
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=content, media_type=content_type, headers=headers)


@router.post("/api/v1/analysis/export/bundle")
async def export_analysis_bundle(payload: AnalysisExportBundleRequest, request: Request):
    raw_content_length = request.headers.get("content-length")
    if raw_content_length:
        try:
            content_length = int(raw_content_length)
            if content_length > REQUEST_SIZE_LIMIT_BYTES:
                raise HTTPException(status_code=413, detail="导出请求体过大")
        except ValueError:
            content_length = 0

    payload_size = estimate_request_size_bytes(payload)
    if payload_size > REQUEST_SIZE_LIMIT_BYTES:
        raise HTTPException(status_code=413, detail="导出请求体过大")

    try:
        export_result = await asyncio.to_thread(build_analysis_export_bundle, payload)
    except AnalysisExportOnlyProfessionalFailedError as exc:
        raise HTTPException(status_code=502, detail=f"仅专业导出失败: {exc}") from exc
    except AnalysisExportEmptyError as exc:
        raise HTTPException(status_code=400, detail=f"无可导出内容: {exc}") from exc
    except AnalysisExportTooLargeError as exc:
        raise HTTPException(status_code=413, detail=f"导出包过大: {exc}") from exc

    filename = str(export_result.get("filename") or "analysis_export.zip")
    content = export_result.get("content") or b""
    if not content:
        raise HTTPException(status_code=400, detail="导出失败：空文件")
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=content, media_type="application/zip", headers=headers)
