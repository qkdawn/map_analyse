"""
Around search helper.
"""

import logging
import time
from typing import Dict, List, Optional
from urllib.parse import urlencode

from core.config import settings

from .get_position import _request_json
from .utils.filter_result import filter_result
from .utils.merge_poi import merge_poi, poi_to_point

logger = logging.getLogger(__name__)

# 分页请求间隔（秒），防止触发高德频控
PAGE_REQUEST_DELAY = 0.3


def get_around_place(
    center: Dict,
    radius: int,
    types: str,
    keywords: str,
    point_type: str,
    api_key: Optional[str] = None,
    mock_pages: Optional[List[Dict]] = None,
) -> List[Dict]:
    """
    Fetch POIs around a center point and convert them to map points.
    """
    if mock_pages is not None:
        pages = mock_pages
    else:
        pages = _fetch_all_pages(center, radius, types, keywords, api_key)

    pois = merge_poi(pages)
    pois = filter_result(pois, ref_point=(center.get("lng"), center.get("lat")))
    return [poi_to_point(poi, fallback_type=point_type) for poi in pois]


def _fetch_all_pages(
    center: Dict,
    radius: int,
    types: str,
    keywords: str,
    api_key: Optional[str],
) -> List[Dict]:
    lng, lat = center["lng"], center["lat"]
    page = 1
    pages: List[Dict] = []

    key = (api_key or settings.amap_web_service_key or "").strip()
    if not key:
        raise ValueError("Gaode Web 服务 key 未配置")

    while True:
        params = {
            "key": key,
            "location": f"{lng},{lat}",
            "radius": radius,
            "keywords": keywords,
            "types": types,
            "page_size": 25,
            "page_num": page,
        }
        url = f"https://restapi.amap.com/v5/place/around?{urlencode(params)}"
        try:
            payload = _request_json(url)
        except Exception as exc:  # noqa: PERF203
            logger.error(
                "Gaode around request failed: page=%s url=%s error=%s",
                page,
                url,
                exc,
                exc_info=True,
            )
            raise

        status = str(payload.get("status") or "")
        if status and status != "1":
            logger.error(
                "Gaode around request returned error: page=%s url=%s status=%s info=%s infocode=%s",
                page,
                url,
                status,
                payload.get("info"),
                payload.get("infocode"),
            )
            raise ValueError(
                f"Gaode around request failed: status={status}, info={payload.get('info')}, infocode={payload.get('infocode')}"
            )
        pois = payload.get("pois") or []
        pages.append(payload)

        logger.debug("Around page %s fetched: %s items", page, len(pois))
        if not pois:
            break
        time.sleep(PAGE_REQUEST_DELAY)
        page += 1

    return pages
