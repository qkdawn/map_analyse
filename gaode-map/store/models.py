"""
ORM 模型定义。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class MapData(Base):
    __tablename__ = "map_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    data = Column(JSON, nullable=False)
    center = Column(JSON, nullable=False)
    center_fingerprint = Column(String(512), nullable=False, index=True)
    search_type = Column(String(20), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class PolygonData(Base):
    __tablename__ = "polygon_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    coordinates = Column(JSON, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class MapPolygonLink(Base):
    __tablename__ = "map_polygon_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    map_id = Column(Integer, ForeignKey("map_data.id"), nullable=False, index=True)
    polygon_id = Column(Integer, ForeignKey("polygon_data.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("map_id", "polygon_id", name="uq_map_polygon"),
    )


class AnalysisHistory(Base):
    """
    空间分析历史记录
    """
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # 存储分析参数 (中心点, 时长, 出行方式)
    params = Column(JSON, nullable=False)
    
    # 存储生成的等时圈多边形 (GeoJSON/Coordinates)
    result_polygon = Column(JSON, nullable=True)
    
    # 简短描述 (e.g. "人民广场 - 15分钟步行")
    description = Column(String(255), nullable=True)


class PoiResult(Base):
    """
    POI 抓取结果
    """
    __tablename__ = "poi_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    history_id = Column(Integer, ForeignKey("analysis_history.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 完整的 POI 数据列表
    poi_data = Column(JSON, nullable=False)
    
    # 统计摘要 (e.g. {"咖啡": 50, "便利店": 30})
    summary = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
