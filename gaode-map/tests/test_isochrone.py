
import sys
import os
from pathlib import Path

# Add project root to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from modules.isochrone import get_isochrone_polygon
from shapely.geometry import Polygon

def test_isochrone():
    print("Testing Isochrone Logic...")
    
    # Test Point: Shanghai People's Square (Approx)
    lat = 31.2304
    lon = 121.4737
    
    print(f"Center: {lat}, {lon} (WGS84)")
    print("Calculating 15min walking isochrone...")
    
    try:
        poly = get_isochrone_polygon(lat, lon, 15*60, "walking")
        
        if isinstance(poly, Polygon):
            print("SUCCESS: Returned a Polygon")
            print(f"Area (Deg^2 approx): {poly.area}")
            print(f"Bounds: {poly.bounds}")
            
            # Simple validation: Check if center is roughly inside/near
            # (Note: centroid might be slightly off due to GCJ transform roundtrip if offset is large, 
            # but for our 'pure' test it should be close)
            print(f"Centroid: {poly.centroid.y}, {poly.centroid.x}")
            
        else:
            print("FAILURE: Did not return a Polygon")
            print(type(poly))

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_isochrone()
