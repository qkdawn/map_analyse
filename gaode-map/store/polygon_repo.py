"""
多边形数据的存取逻辑。
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from .database import SessionLocal
from .models import MapPolygonLink, PolygonData

logger = logging.getLogger(__name__)


def save_polygon(map_id: int, coordinates: list) -> int:
    """
    保存多边形坐标并绑定 map_id，返回多边形 id。
    """
    session = SessionLocal()
    try:
        polygon = PolygonData(coordinates=coordinates)
        session.add(polygon)
        session.flush()
        link = MapPolygonLink(map_id=map_id, polygon_id=polygon.id)
        session.add(link)
        session.commit()
        session.refresh(polygon)
        logger.info("多边形已保存，map_id=%s polygon_id=%s", map_id, polygon.id)
        return polygon.id
    except Exception:
        session.rollback()
        logger.exception("保存多边形失败 map_id=%s", map_id)
        raise
    finally:
        session.close()


def list_polygons_for_map(map_id: int) -> list:
    """
    获取地图关联的多边形列表。
    """
    session = SessionLocal()
    try:
        stmt = (
            select(PolygonData.id, PolygonData.coordinates)
            .join(MapPolygonLink, MapPolygonLink.polygon_id == PolygonData.id)
            .where(MapPolygonLink.map_id == map_id)
            .order_by(MapPolygonLink.created_at.asc(), PolygonData.id.asc())
        )
        rows = session.execute(stmt).all()
        return [{"id": row[0], "coordinates": row[1]} for row in rows]
    finally:
        session.close()


def delete_polygon(map_id: int, polygon_id: int) -> bool:
    """
    删除指定地图关联的多边形记录。
    """
    session = SessionLocal()
    try:
        link_stmt = select(MapPolygonLink).where(
            MapPolygonLink.map_id == map_id,
            MapPolygonLink.polygon_id == polygon_id,
        )
        link = session.execute(link_stmt).scalar_one_or_none()
        if not link:
            return False
        session.delete(link)
        session.flush()

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
        logger.info("多边形已删除 map_id=%s polygon_id=%s", map_id, polygon_id)
        return True
    except Exception:
        session.rollback()
        logger.exception("删除多边形失败 map_id=%s polygon_id=%s", map_id, polygon_id)
        raise
    finally:
        session.close()
