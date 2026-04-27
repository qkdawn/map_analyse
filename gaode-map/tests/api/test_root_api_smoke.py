import pytest
import requests


@pytest.mark.skip(reason="manual smoke test; requires running local server")
def test_poi_api_smoke_manual():
    url = "http://localhost:8000/api/v1/analysis/pois"
    payload = {
        "polygon": [
            [116.39, 39.90],
            [116.40, 39.90],
            [116.40, 39.91],
            [116.39, 39.91],
            [116.39, 39.90],
        ],
        "keywords": "肯德基",
        "max_count": 5,
    }
    headers = {"Content-Type": "application/json"}
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    assert response.status_code in (200, 502)
