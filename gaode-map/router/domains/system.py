from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, Response

from core.config import settings
from modules.map_manage.schemas import MapRequest
from store import (
    build_center_fingerprint,
    find_map_by_fingerprint,
)
from utils import generate_html_content, load_type_config, parse_json

router = APIRouter()


@router.get("/health", summary="健康检查")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
    }


@router.get("/", summary="根路径")
async def root():
    return {
        "message": "欢迎使用高德地图扣子插件API",
        "docs": f"{settings.app_base_url}/docs",
        "health": f"{settings.app_base_url}/health",
    }


@router.get("/favicon.ico", include_in_schema=False)
async def favicon():
    icon_path = os.path.join(settings.static_dir, "favicon.ico")
    if os.path.exists(icon_path):
        return FileResponse(icon_path)
    return Response(status_code=204)


@router.get("/api/v1/config", summary="获取APP配置")
async def get_frontend_config():
    return {
        "amap_js_api_key": settings.amap_js_api_key,
        "amap_js_security_code": settings.amap_js_security_code,
        "tianditu_key": settings.tianditu_key,
        "map_type_config_json": load_type_config(),
    }


@router.get("/map", response_class=HTMLResponse, summary="渲染常规地图")
async def render_map_page(
    search_type: str = Query(..., alias="type"),
    location: str = Query(..., description="lng,lat"),
    place_types: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
):
    normalized_type = (search_type or "").strip()
    if normalized_type not in ("around", "city"):
        raise HTTPException(status_code=400, detail="Type must be 'around' or 'city'")

    try:
        parts = location.split(",")
        lng = float(parts[0])
        lat = float(parts[1])
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid location format") from exc

    parsed_place_types = parse_json(place_types)
    normalized_place_types = tuple(item for item in (parsed_place_types or []) if item)
    effective_source = (source or "gaode").strip()
    effective_year = year or datetime.now().year

    fingerprint = build_center_fingerprint(
        {"lng": lng, "lat": lat},
        normalized_type,
        normalized_place_types,
        effective_source,
        effective_year,
    )

    existing = find_map_by_fingerprint(fingerprint)
    if not existing:
        raise HTTPException(status_code=404, detail="Map data not found")

    map_id, map_data, _ = existing
    map_req = MapRequest(**map_data)
    html_content = await generate_html_content(map_req, map_id=map_id)
    return HTMLResponse(content=html_content)


@router.get("/analysis", response_class=FileResponse, summary="渲染分析工作台")
async def render_analysis_page():
    frontend_index = Path(settings.static_dir).resolve() / "frontend" / "index.html"
    if not frontend_index.exists():
        raise HTTPException(
            status_code=503,
            detail="frontend 构建产物不存在，请先在 frontend 目录执行 npm run build",
        )
    return FileResponse(
        frontend_index,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
