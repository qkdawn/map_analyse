"""
地图数据的存取逻辑。
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select

from .database import SessionLocal
from .fingerprint import _center_fingerprint
from .models import MapData, MapPolygonLink, PolygonData

logger = logging.getLogger(__name__)


def save_map_data(
    map_data: Dict,
    center: Dict,
    search_type: str,
    place_types: Optional[Tuple[str, ...]] = None,
    source: Optional[str] = None,
    year: Optional[int] = None,
) -> int:
    """
    保存地图数据，返回自增主键。
    """
    session = SessionLocal()
    try:
        normalized_type = (search_type or "").strip()
        record = MapData(
            data=map_data,
            center=center,
            center_fingerprint=_center_fingerprint(center, normalized_type, place_types, source, year),
            search_type=normalized_type,
            expires_at=None,
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        logger.info("地图数据已保存，id=%s", record.id)
        return record.id
    except Exception:
        session.rollback()
        logger.exception("保存地图数据失败")
        raise
    finally:
        session.close()


def get_map_data(map_id: int) -> Optional[Dict]:
    """
    按 id 获取地图数据，若不存在返回 None。
    """
    session = SessionLocal()
    try:
        stmt = select(MapData).where(MapData.id == map_id)
        record = session.execute(stmt).scalar_one_or_none()
        if not record:
            return None
        return record.data
    finally:
        session.close()


def find_map_by_center_and_type(
    center: Dict,
    search_type: str,
    place_types: Optional[Tuple[str, ...]] = None,
    source: Optional[str] = None,
    year: Optional[int] = None,
) -> Optional[Tuple[int, Dict, Optional[datetime]]]:
    """
    按中心点指纹查找记录，返回 (id, data, expires_at)。
    """
    session = SessionLocal()
    try:
        normalized_type = (search_type or "").strip()
        fingerprint = _center_fingerprint(center, normalized_type, place_types, source, year)
        stmt = (
            select(MapData)
            .where(
                MapData.center_fingerprint == fingerprint,
            )
            .order_by(MapData.created_at.desc())
        )
        # 仅取最新一条，避免重复数据导致 MultipleResultsFound
        record = session.scalars(stmt.limit(1)).first()
        if not record:
            return None
        return record.id, record.data, record.expires_at
    finally:
        session.close()


def find_map_by_fingerprint(
    fingerprint: str,
) -> Optional[Tuple[int, Dict, Optional[datetime]]]:
    """
    按指纹查找记录，返回 (id, data, expires_at)。
    """
    if not fingerprint:
        return None
    session = SessionLocal()
    try:
        stmt = (
            select(MapData)
            .where(
                MapData.center_fingerprint == fingerprint,
            )
            .order_by(MapData.created_at.desc())
        )
        record = session.scalars(stmt.limit(1)).first()
        if not record:
            return None
        return record.id, record.data, record.expires_at
    finally:
        session.close()


def list_maps_with_polygons(limit: int = 200, offset: int = 0) -> List[Dict]:
    """
    获取地图列表及其关联的多边形数据。
    """
    session = SessionLocal()
    try:
        maps_stmt = (
            select(
                MapData.id,
                MapData.center,
                MapData.search_type,
                MapData.center_fingerprint,
                MapData.created_at,
            )
            .order_by(MapData.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        map_rows = session.execute(maps_stmt).all()
        if not map_rows:
            return []
        map_ids = [row[0] for row in map_rows]
        polygon_stmt = (
            select(MapPolygonLink.map_id, PolygonData.id, PolygonData.coordinates)
            .join(PolygonData, PolygonData.id == MapPolygonLink.polygon_id)
            .where(MapPolygonLink.map_id.in_(map_ids))
            .order_by(MapPolygonLink.created_at.asc(), PolygonData.id.asc())
        )
        polygon_rows = session.execute(polygon_stmt).all()
        polygons_by_map: Dict[int, List[Dict]] = {}
        for map_id, polygon_id, coordinates in polygon_rows:
            polygons_by_map.setdefault(map_id, []).append(
                {"id": polygon_id, "coordinates": coordinates}
            )
        return [
            {
                "id": row[0],
                "center": row[1],
                "search_type": row[2],
                "center_fingerprint": row[3],
                "created_at": row[4],
                "polygons": polygons_by_map.get(row[0], []),
            }
            for row in map_rows
        ]
    finally:
        session.close()


def delete_map(map_id: int) -> bool:
    """
    删除地图及其关联关系，清理无人引用的多边形。
    """
    session = SessionLocal()
    try:
        map_record = session.execute(
            select(MapData).where(MapData.id == map_id)
        ).scalar_one_or_none()
        if not map_record:
            return False
        polygon_ids = [
            row[0]
            for row in session.execute(
                select(MapPolygonLink.polygon_id).where(MapPolygonLink.map_id == map_id)
            ).all()
        ]
        session.execute(
            MapPolygonLink.__table__.delete().where(MapPolygonLink.map_id == map_id)
        )
        session.delete(map_record)
        for polygon_id in polygon_ids:
            remaining = session.execute(
                select(MapPolygonLink).where(MapPolygonLink.polygon_id == polygon_id).limit(1)
            ).scalar_one_or_none()
            if not remaining:
                polygon = session.execute(
                    select(PolygonData).where(PolygonData.id == polygon_id)
                ).scalar_one_or_none()
                if polygon:
                    session.delete(polygon)
        session.commit()
        logger.info("地图已删除 map_id=%s", map_id)
        return True
    except Exception:
        session.rollback()
        logger.exception("删除地图失败 map_id=%s", map_id)
        raise
    finally:
        session.close()
