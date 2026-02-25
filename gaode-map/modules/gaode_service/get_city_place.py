"""
City level POI search helper.
"""

import logging
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode

from core.config import settings

from .get_position import _request_json
from .utils.filter_result import filter_result
from .utils.merge_poi import merge_poi, poi_to_point
import json

logger = logging.getLogger(__name__)

# 分页请求间隔（秒），防止触发高德频控
PAGE_REQUEST_DELAY = 0.3


def get_city_place(
    place: str,
    types: str,
    keywords: str,
    point_type: str,
    api_key: Optional[str] = None,
    mock_city: Optional[Dict] = None,
    mock_pages: Optional[List[Dict]] = None,
    center: Optional[Dict] = None,
) -> Tuple[Dict, List[Dict]]:
    """
    Fetch POIs by city keyword and convert them to map points.
    Returns center info (city center) and list of points.
    """
    city_payload: Optional[Dict] = mock_city
    if not center or not center.get("adcode"):
        city_payload = city_payload

    adcode = (center or {}).get("adcode") or ""
    district = None
    if city_payload:
        districts = city_payload.get("districts") or []
        if not districts:
            raise ValueError(f"Gaode district query returned no results for {place}")
        district = districts[0]
        adcode = adcode or district.get("adcode", "")
        # 若传入的 center 缺少坐标，则使用 district 的中心点。
        if not center or not center.get("lng") or not center.get("lat"):
            center_str = district.get("center", "0,0")
            center_lng, center_lat = (center_str.split(",") + ["0", "0"])[:2]
            center = {
                "lng": float(center_lng),
                "lat": float(center_lat),
                "name": district.get("name") or place,
                "type": "center",
                "adcode": adcode,
            }

    if not center and not city_payload:
        raise ValueError("中心点信息缺失，且无法从城市信息获取")

    if not center:
        raise ValueError("中心点信息缺失，且无法从城市信息获取")
    if adcode:
        center["adcode"] = adcode

    if mock_pages is not None:
        pages = mock_pages
    else:
        pages = _fetch_city_pages(adcode, types, keywords, api_key)

    pois = merge_poi(pages)
    # Save POIs to local storage
    # try:
    #     with open("pois_data.json", "w", encoding="utf-8") as f:
    #         json.dump(pois, f, ensure_ascii=False, indent=4)
    #     logger.info("POIs data saved to pois_data.json")
    # except Exception as e:
    #     logger.error("Failed to save POIs data: %s", e)
    pois = filter_result(pois, ref_point=(center["lng"], center["lat"]))
    points = [poi_to_point(poi, fallback_type=point_type) for poi in pois]
    return center, points


def _fetch_city_pages(
    adcode: str, types: str, keywords: str, api_key: Optional[str]
) -> List[Dict]:
    page = 1
    pages: List[Dict] = []

    key = (api_key or settings.amap_web_service_key or "").strip()
    if not key:
        raise ValueError("Gaode Web 服务 key 未配置")

    while True:
        params = {
            "key": key,
            "city": adcode,
            "citylimit": "true",
            "types": types,
            "keywords": keywords,
            "offset": 25,
            "page": page,
            "extensions": "all",
        }
        url = f"https://restapi.amap.com/v3/place/text?{urlencode(params)}"
        payload = _request_json(url)
        pois = payload.get("pois") or []
        pages.append(payload)

        logger.info("City page %s fetched: %s items", page, len(pois))
        if not pois:
            break
        time.sleep(PAGE_REQUEST_DELAY)
        page += 1

    return pages


# 已废弃，不再单独请求城市信息，在 get_position 中获取 adcode 即可。
# def _fetch_city_info(place: str, api_key: Optional[str]) -> Dict:
#     key = (api_key or settings.amap_web_service_key or "").strip()
#     if not key:
#         raise ValueError("Gaode Web 服务 key 未配置")
#     params = {
#         "keywords": place,
#         "subdistrict": 0,
#         "extensions": "all",
#         "key": key,
#     }
#     url = f"https://restapi.amap.com/v3/config/district?{urlencode(params)}"
#     return _request_json(url)