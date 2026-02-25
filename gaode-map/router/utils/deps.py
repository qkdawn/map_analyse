import asyncio
import logging

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from core.config import settings
from modules.map_manage.schemas import MapRequest
from store import get_map_data

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="Authorization", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)) -> bool:
    """
    API密钥验证依赖
    """
    if not api_key:
        logger.warning("API密钥缺失")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API密钥缺失：请在请求头中添加 Authorization: Bearer YOUR_API_KEY",
            headers={"WWW-Authenticate": "Bearer"},
        )

    api_key_clean = api_key.replace("Bearer ", "") if api_key.startswith("Bearer ") else api_key

    if api_key_clean not in settings.api_keys:
        logger.warning("无效的API密钥尝试: %s...", api_key[:10])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API密钥无效：请检查密钥是否正确",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.debug("API密钥验证成功")
    return True


async def load_map_request(map_id: int) -> MapRequest:
    """
    从数据库加载并校验地图数据。
    """
    map_data_dict = await asyncio.to_thread(get_map_data, map_id)
    if not map_data_dict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="地图数据不存在或已过期",
        )
    try:
        return MapRequest(**map_data_dict)
    except Exception as exc:  # noqa: BLE001
        logger.error("地图数据校验失败 id=%s: %s", map_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="地图数据异常，请稍后重试",
        )
