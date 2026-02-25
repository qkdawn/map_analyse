from typing import List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator

class LocationPoint(BaseModel):
    """
    位置点数据模型
    定义地图上一个点的属性，使用Pydantic进行数据验证
    """

    lng: float = Field(..., description="经度", ge=-180, le=180)
    lat: float = Field(..., description="纬度", ge=-90, le=90)
    name: str = Field(..., description="位置名称", min_length=1)
    type: str = Field("default", description="位置类型")
    lines: Optional[List[str]] = Field(None, description="途经线路")
    distance: Optional[int] = Field(None, description="距离(米)")
    year: Optional[int] = Field(None, description="年份")

class MapGenerateRequest(BaseModel):
    """
    用户请求模型
    只需提供地点和请求类型（around/city），其他参数由服务默认生成
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    place: str = Field(..., description="地点名称，如城市或地标", min_length=1)
    type: Literal["around", "city"] = Field(
        ..., description="查询类型：around（附近）或 city（整城）"
    )
    source: Optional[Literal["gaode", "local"]] = Field(
        "gaode",
        description="数据来源：gaode（高德）或 local（本地历史数据）",
    )
    year: Optional[int] = Field(None, description="查询年份，仅 local 模式使用")
    radius: int = Field(1200, description="半径(米)", gt=0)
    place_types: Optional[List[str]] = Field(
        None,
        alias="place_types",
        description="可选：查询的类别数组，例如 ['公交站','地铁站']，优先使用该配置"
    )

    @model_validator(mode="before")
    def _handle_legacy_alias(cls, values):
        if isinstance(values, dict) and "place_types" not in values and "search_type" in values:
            values["place_types"] = values["search_type"]
        return values


class MapResponse(BaseModel):
    """
    地图生成响应模型
    服务端返回的响应数据
    """

    status: int = Field(..., description="状态码")
    message: str = Field(..., description="提示信息")
    url: Optional[str] = Field(None, description="生成的地图页面URL")
    expires_at: Optional[str] = Field(None, description="过期时间")
