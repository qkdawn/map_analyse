"""
配置管理模块
使用Pydantic Settings从环境变量加载配置
"""

from pathlib import Path
from typing import List, Literal, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    应用配置类
    从环境变量加载配置，支持类型转换和验证
    """

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",  # 未声明的 env 变量忽略，不抛出校验错误
    )

    # 应用配置
    app_host: str = "0.0.0.0"  # 应用主机地址，默认0.0.0.0（允许外部访问）
    app_port: int = 8000  # 应用端口，默认8000
    app_base_url: str = "http://localhost:8000"  # 基础URL，用于生成完整的访问链接

    # API密钥配置
    api_keys: List[str] = ["dev-only-key-change-in-production"]  # API密钥列表，用于访问鉴权

    # 文件存储配置
    static_dir: str = str(Path(__file__).resolve().parent.parent / "static")  # 静态资源根目录
    templates_dir: str = str(Path(__file__).resolve().parent.parent / "templates")  # Jinja模板目录
    template_name: str = "map_with_filters.html"  # 默认模板文件名
    file_lifetime_hours: int = Field(
        168,
        validation_alias="FILE_LIFETIME_HOURS",
        description="Generated file retention period in hours",
    )
    cleanup_interval_hours: int = Field(
        24,
        validation_alias="CLEANUP_INTERVAL_HOURS",
        description="Background cleanup interval in hours",
    )
    db_path: str = str(Path(__file__).resolve().parent.parent / "data" / "map.db")  # SQLite 数据文件路径
    db_url: Optional[str] = Field(None, validation_alias="DB_URL", description="数据库连接字符串")

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.db_url:
            return self.db_url
        return f"sqlite:///{self.db_path}"

    # 高德地图API配置
    amap_web_service_key: str = Field(
        "",
        validation_alias="AMAP_WEB_SERVICE_KEY",
        description="高德 Web 服务（Web API）Key，支持多个Key用英文逗号分隔",
    )
    amap_js_api_key: str = Field(
        validation_alias= "AMAP_JS_API_KEY",
        description="高德 Web JS API Key",
    )
    amap_js_security_code: str = Field(
        "",
        validation_alias="AMAP_JS_SECURITY_CODE",
        description="高德 JS 安全码（若未开启可留空）",
    )
    tianditu_key: str = Field(
        "",
        validation_alias="TIANDITU_KEY",
        description="天地图 Web 瓦片服务 Key（tk）",
    )

    # 本地历史数据查询服务配置
    local_query_base_url: str = Field(
        "http://127.0.0.1:8001",
        validation_alias="LOCAL_QUERY_BASE_URL",
        description="本地历史数据查询服务地址",
    )
    local_query_coord_system: Literal["gcj02", "wgs84"] = Field(
        "gcj02",
        validation_alias="LOCAL_QUERY_COORD_SYSTEM",
        description="本地历史数据查询服务使用的坐标系（location 字段）",
    )

    # CORS跨域配置
    cors_origins: List[str] = ["*"]  # 允许访问的域名列表

    # 等时圈（Isochrone）配置
    valhalla_base_url: str = Field(
        "http://127.0.0.1:8002",
        validation_alias="VALHALLA_BASE_URL",
        description="Valhalla 路由引擎基础地址",
    )
    valhalla_timeout_s: int = Field(
        60,
        validation_alias="VALHALLA_TIMEOUT_S",
        description="Valhalla 请求超时时间（秒）",
    )
    overpass_endpoint: str = Field(
        "http://overpass/api/interpreter",
        validation_alias="OVERPASS_ENDPOINT",
        description="Local Overpass API endpoint",
    )

    # ArcGIS HTTP bridge config
    arcgis_bridge_enabled: bool = Field(
        True,
        validation_alias="ARCGIS_BRIDGE_ENABLED",
        description="Whether ArcGIS HTTP bridge is enabled",
    )
    arcgis_bridge_base_url: str = Field(
        "http://host.docker.internal:18081",
        validation_alias="ARCGIS_BRIDGE_BASE_URL",
        description="ArcGIS bridge base URL",
    )
    arcgis_bridge_token: str = Field(
        "",
        validation_alias="ARCGIS_BRIDGE_TOKEN",
        description="Shared token used in X-ArcGIS-Token header",
    )
    arcgis_bridge_timeout_s: int = Field(
        300,
        validation_alias="ARCGIS_BRIDGE_TIMEOUT_S",
        description="ArcGIS bridge request timeout in seconds",
    )
    arcgis_export_timeout_s: int = Field(
        600,
        validation_alias="ARCGIS_EXPORT_TIMEOUT_S",
        description="ArcGIS export timeout in seconds",
    )
    arcgis_export_max_mb: int = Field(
        512,
        validation_alias="ARCGIS_EXPORT_MAX_MB",
        description="Maximum export file size accepted from bridge (MB)",
    )

    # depthmapX CLI config
    depthmapx_cli_path: str = Field(
        "depthmapXcli",
        validation_alias="DEPTHMAPX_CLI_PATH",
        description="Executable path of depthmapXcli",
    )
    depthmapx_timeout_s: int = Field(
        300,
        validation_alias="DEPTHMAPX_TIMEOUT_S",
        description="Timeout for one depthmapXcli command (seconds)",
    )
    depthmapx_tulip_bins: int = Field(
        1024,
        validation_alias="DEPTHMAPX_TULIP_BINS",
        description="Tulip bins for segment tulip analysis (4-1024)",
    )


settings = Settings()
