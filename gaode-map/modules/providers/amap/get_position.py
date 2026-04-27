"""
Geocoding helper using the Gaode geocode API.
"""

import json
import logging
import ssl
from typing import Dict, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from core.config import settings

logger = logging.getLogger(__name__)


def get_position(
    place: str,
    api_key: Optional[str] = None,
    mock_response: Optional[Dict] = None,
) -> Dict:
    """
    Resolve an address/place name to coordinates and return
    a center structure that matches the map request schema.
    """
    if mock_response:
        payload = mock_response
    else:
        key = (api_key or settings.amap_web_service_key or "").strip()
        if not key:
            raise ValueError("Gaode Web 服务 key 未配置")
        params = {
            "key": key,
            "address": place,
        }
        url = f"https://restapi.amap.com/v3/geocode/geo?{urlencode(params)}"
        payload = _request_json(url)
    logger.debug("Gaode geocode response: %s", payload)
    geocodes = payload.get("geocodes", [])
    if not geocodes:
        raise ValueError(f"Gaode geocode returned no results for {place}")

    location = geocodes[0].get("location", "")
    lng_str, lat_str = (location.split(",") + ["0", "0"])[:2]
    lng, lat = float(lng_str), float(lat_str)

    center = {
        "lng": lng,
        "lat": lat,
        "name": place,
        "type": "center",
        "adcode": geocodes[0].get("adcode", ""),
        "city": geocodes[0].get("city", ""),
        "citycode": geocodes[0].get("citycode", ""),
    }
    logging.debug("Resolved position for '%s': %s", place, center)
    return center


def _request_json(url: str) -> Dict:
    logger.debug("Requesting Gaode API: %s", url)
    req = Request(url, headers={"User-Agent": "gaode-map-plugin/1.0"})
    # 关闭证书校验以规避本地缺少根证书导致的 SSL 错误
    ssl_context = ssl._create_unverified_context()
    with urlopen(req, timeout=5*60, context=ssl_context) as resp:
        data = resp.read()
    return json.loads(data.decode("utf-8"))
