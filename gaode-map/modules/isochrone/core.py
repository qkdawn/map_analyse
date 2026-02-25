
from shapely.geometry import Point, Polygon
from .adapter import fetch_amap_isochrone

def get_isochrone_polygon(lat: float, lon: float, time_sec: int, mode: str = "walking") -> Polygon:
    """
    Get the isochrone polygon for a specific point and time.
    
    Args:
        lat: Latitude (WGS84)
        lon: Longitude (WGS84)
        time_sec: Time in seconds
        mode: Transport mode ('walking', 'driving', 'bicycling')
        
    Returns:
        Shapely Polygon (WGS84) representing the reachable area.
    """
    center = Point(lon, lat)
    
    # We delegate the complexity of API calls and Coordinate Systems to the Adapter.
    # The Core module only deals with the business intent (Get Polygon).
    polygon = fetch_amap_isochrone(center, time_sec, mode)
    
    return polygon
