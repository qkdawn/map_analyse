from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
# Need PolygonRecord here. Can import from map_manage to share, or duplicate.
# Given Admin sees what User sees, sharing is fine.
# But for strict decoupling, let's duplicate or put PolygonRecord in a common place.
# Let's import from map_manage for now as it's the specific module managing maps.
from modules.map_manage.schemas import PolygonRecord

class AdminMapRecord(BaseModel):
    """
    后台地图记录
    """
    id: int = Field(..., description="地图ID")
    created_at: datetime = Field(..., description="创建时间")
    search_type: str = Field(..., description="查询类型")
    center: dict = Field(..., description="中心点坐标")
    source: Optional[str] = Field(None, description="数据来源")
    year: Optional[int] = Field(None, description="年份")
    map_url: str = Field(..., description="地图访问URL")
    polygons: List[PolygonRecord] = Field(default_factory=list, description="多边形列表")

class AdminMapListResponse(BaseModel):
    """
    后台地图列表响应
    """
    maps: List[AdminMapRecord] = Field(default_factory=list, description="地图列表")
