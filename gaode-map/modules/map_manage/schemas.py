from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
# Import LocationPoint if needed, or redefine it. 
# Since LocationPoint is used in MapRequest, and it's basic, we can import it or duplicate.
# For loose coupling, duplicating a simple Point model or moving LocationPoint to a common place is better.
# For now, I'll import from gaode_service to avoid circular deps if they are distinct, 
# or just duplicate it here if it's small. Let's duplicate to ensure independence.

class LocationPoint(BaseModel):
    """
    位置点数据模型 (Copy for independence)
    """
    lng: float = Field(..., description="经度", ge=-180, le=180)
    lat: float = Field(..., description="纬度", ge=-90, le=90)
    name: str = Field(..., description="位置名称", min_length=1)
    type: str = Field("default", description="位置类型")
    lines: Optional[List[str]] = Field(None, description="途经线路")
    distance: Optional[int] = Field(None, description="距离(米)")
    year: Optional[int] = Field(None, description="年份")

class MapRequest(BaseModel):
    """
    地图生成请求模型 (Internal Stored Data)
    经过服务内部生成的完整地图数据
    """
    center: dict = Field(..., description="中心点坐标")
    radius: int = Field(..., description="半径(米)", gt=0)
    points: List[LocationPoint] = Field(..., description="位置点列表", min_items=1)
    adcode: Optional[str] = Field(None, description="城市行政区编码，city 模式用于绘制边界")

class PolygonCreateRequest(BaseModel):
    """
    多边形创建请求
    """
    coordinates: List[List[float]] = Field(..., description="多边形坐标数组")

    @field_validator("coordinates")
    @classmethod
    def _validate_coordinates(cls, value):
        if not isinstance(value, list) or len(value) < 3:
            raise ValueError("多边形至少需要 3 个坐标点")
        normalized = []
        for item in value:
            if not isinstance(item, (list, tuple)) or len(item) != 2:
                raise ValueError("坐标点必须为 [lng, lat] 数组")
            lng = float(item[0])
            lat = float(item[1])
            if not (-180 <= lng <= 180 and -90 <= lat <= 90):
                raise ValueError("坐标点超出范围")
            normalized.append([lng, lat])
        return normalized

class PolygonRecord(BaseModel):
    """
    多边形记录
    """
    id: int = Field(..., description="多边形ID")
    coordinates: List[List[float]] = Field(..., description="多边形坐标数组")

class PolygonListResponse(BaseModel):
    """
    多边形列表响应
    """
    polygons: List[PolygonRecord] = Field(default_factory=list, description="多边形列表")
