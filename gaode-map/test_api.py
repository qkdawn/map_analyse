import requests
import json

url = "http://localhost:8000/api/v1/analysis/pois"
payload = {
    "polygon": [[116.39, 39.90], [116.40, 39.90], [116.40, 39.91], [116.39, 39.91], [116.39, 39.90]],
    "keywords": "肯德基",
    "max_count": 5
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}...") # Print first 500 chars
except Exception as e:
    print(f"Error: {e}")
