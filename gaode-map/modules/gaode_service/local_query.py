"""
Local history data query helpers.
"""

from typing import Dict, List, Optional
from urllib.parse import urlencode

from core.config import settings

from .get_position import _request_json
from .utils.transform_posi import gcj02_to_wgs84


def query_local_around(
    center: Dict,
    radius: int,
    types: str,
    year: Optional[int] = None,
    base_url: Optional[str] = None,
) -> List[Dict]:
    """
    Query local API by center/radius/types/year.
    """
    lng = center["lng"]
    lat = center["lat"]
    if settings.local_query_coord_system == "wgs84":
        lng, lat = gcj02_to_wgs84(lng, lat)
    params = {
        "location": f"{lng},{lat}",
        "radius": radius,
        "types": types,
        "page_size": -1
    }
    if year is not None:
        params["year"] = year
    url = f"{_resolve_base_url(base_url)}/place/around?{urlencode(params)}"
    payload = _request_json(url)
    _validate_payload(payload, url)
    return payload.get("pois") or []


def query_local_city(
    adcode: str,
    types: str,
    year: Optional[int] = None,
    city_name: Optional[str] = None,
    city_code: Optional[str] = None,
    base_url: Optional[str] = None,
) -> List[Dict]:
    """
    Query local API by adcode/types/year.
    """
    params = {
        "cityCode": city_code or adcode,
        "types": types,
        "page_size": -1
    }
    if city_name:
        params["cityName"] = city_name
    if year is not None:
        params["year"] = year
    url = f"{_resolve_base_url(base_url)}/place/city?{urlencode(params)}"
    payload = _request_json(url)
    _validate_payload(payload, url)
    return payload.get("pois") or []


def _resolve_base_url(base_url: Optional[str]) -> str:
    return (base_url or settings.local_query_base_url).rstrip("/")


def _validate_payload(payload: Dict, url: str) -> None:
    status = str(payload.get("status") or "")
    if status and status != "1":
        raise ValueError(
            f"Local query failed: url={url}, status={status}, info={payload.get('info')}, infocode={payload.get('infocode')}"
        )
