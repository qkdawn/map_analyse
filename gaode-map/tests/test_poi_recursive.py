
import sys
import asyncio
import logging
from unittest.mock import MagicMock, patch
from pathlib import Path

# Add project root
sys.path.append(str(Path(__file__).resolve().parent.parent))

from modules.poi.core import fetch_pois_by_polygon, RateLimiter

logging.basicConfig(level=logging.INFO)

async def test_adaptive_recursion():
    print("Testing Adaptive Recursive POI Fetching...")
    
    # Mock Polygon (Square)
    polygon = [
        [121.47, 31.23], [121.48, 31.23], 
        [121.48, 31.24], [121.47, 31.24], 
        [121.47, 31.23]
    ]
    
    # Mock Context
    # We will mock the internal helpers to avoid real HTTP requests
    
    with patch("modules.poi.core.get_hexagon_children") as mock_children, \
         patch("modules.poi.core._fetch_amap_page_one") as mock_fetch_one, \
         patch("modules.poi.core._fetch_remaining_pages") as mock_remaining:
         
        # Setup Mocks
        # 1. First call (Parent Hex) -> Returns 1000 count (Trigger subdivision)
        # 2. Child calls -> Return 10 count (Normal fetch)
        
        # We need to simulate the implementation of fetch_pois_by_polygon calling these
        # It calls polygon_to_hexagons first. Let's assume it returns 1 cell.
        
        mock_children.return_value = ["child_1", "child_2"]
        
        # Side effect for fetch_one: 
        # First call (args has parent boundary) -> 1000
        # Subsequent calls (args has child boundary) -> 10
        
        call_count = 0
        async def side_effect_fetch(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 1: # The very first call (parent) from the loop
                # Return count=1000, pois=[]
                return 1000, []
            else:
                # Children
                return 10, [{"id": f"p_{call_count}", "location": "121.475,31.235"}]
        
        mock_fetch_one.side_effect = side_effect_fetch
        
        # execution
        # We need a dummy api key in settings, but we can patch settings too if needed.
        # But let's rely on default config or mock if it fails.
        # Actually core.py checks settings.amap_web_service_key.
        
        with patch("modules.poi.core.settings") as mock_settings:
            mock_settings.amap_web_service_key = "dummy_key"
            
            results = await fetch_pois_by_polygon(polygon, "food")
            
            print(f"Total Results: {len(results)}")
            
            # Verification
            # Should have called children
            if mock_children.called:
                print("SUCCESS: Subdivided parent hexagon.")
            else:
                print("FAILURE: Did not subdivide.")
                
            # Should have results from children
            if len(results) > 0:
                print("SUCCESS: Got results from children.")
            else:
                print("FAILURE: No results.")

if __name__ == "__main__":
    asyncio.run(test_adaptive_recursion())
