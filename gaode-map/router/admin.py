import asyncio
import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, status

from core.config import settings
from modules.admin.schemas import AdminMapRecord, AdminMapListResponse
from modules.map_manage.schemas import PolygonRecord
from store import delete_map, list_maps_with_polygons

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _parse_fingerprint(fingerprint: str) -> Dict[str, Any]:
    if not fingerprint:
        return {}
    try:
        return json.loads(fingerprint)
    except json.JSONDecodeError:
        return {}


def _build_map_url(
    search_type: str,
    center: Dict[str, Any],
    source: Optional[str],
    year: Optional[int],
    place_types: Optional[List[str]],
) -> str:
    base_url = settings.app_base_url.rstrip("/")
    location = f"{center.get('lng')},{center.get('lat')}"
    params: Dict[str, str] = {
        "type": search_type,
        "location": location,
    }
    if source and source != "gaode":
        params["source"] = source
    if year is not None:
        params["year"] = str(year)
    normalized_place_types = [item for item in (place_types or []) if item]
    if normalized_place_types:
        params["place_types"] = json.dumps(normalized_place_types, ensure_ascii=False)
    return f"{base_url}/map?{urlencode(params)}"


@router.get(
    "/maps",
    response_model=AdminMapListResponse,
    summary="获取后台地图列表",
)
async def list_admin_maps(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    获取地图列表，包含多边形信息，用于后台管理展示。
    """
    maps = await asyncio.to_thread(list_maps_with_polygons, limit=limit, offset=offset)
    response_maps: List[AdminMapRecord] = []
    for record in maps:
        fingerprint_payload = _parse_fingerprint(record.get("center_fingerprint", ""))
        source = fingerprint_payload.get("source") or None
        year = fingerprint_payload.get("year")
        place_types = fingerprint_payload.get("place_types") or []
        map_url = _build_map_url(
            record.get("search_type"),
            record.get("center") or {},
            source,
            year,
            place_types,
        )
        polygons = [
            PolygonRecord(id=item["id"], coordinates=item["coordinates"])
            for item in record.get("polygons", [])
        ]
        response_maps.append(
            AdminMapRecord(
                id=record["id"],
                created_at=record["created_at"],
                search_type=record["search_type"],
                center=record["center"],
                source=source,
                year=year,
                map_url=map_url,
                polygons=polygons,
            )
        )
    logger.info("后台地图列表获取成功 count=%s", len(response_maps))
    return AdminMapListResponse(maps=response_maps)


@router.delete(
    "/maps/{map_id}",
    summary="删除地图及其关联多边形",
)
async def delete_admin_map(map_id: int):
    """
    删除地图及其关联多边形。
    """
    deleted = await asyncio.to_thread(delete_map, map_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="地图数据不存在或已过期",
        )
    return {"status": "ok"}
