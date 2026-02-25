"""
Manual acceptance script for /api/v1/analysis/h3-grid
Usage:
  python scripts/verify_h3_grid_api.py --base-url http://127.0.0.1:8000
"""

import argparse
import requests


def build_sample_polygon():
    lat = 31.2304
    lon = 121.4737
    d = 0.01
    return [
        [lon - d, lat - d],
        [lon + d, lat - d],
        [lon + d, lat + d],
        [lon - d, lat + d],
        [lon - d, lat - d],
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--resolution", type=int, default=9)
    parser.add_argument("--coord-type", choices=["gcj02", "wgs84"], default="wgs84")
    parser.add_argument("--include-mode", choices=["intersects", "inside"], default="intersects")
    parser.add_argument("--min-overlap-ratio", type=float, default=0.0)
    args = parser.parse_args()

    url = args.base_url.rstrip("/") + "/api/v1/analysis/h3-grid"
    payload = {
        "polygon": build_sample_polygon(),
        "resolution": args.resolution,
        "coord_type": args.coord_type,
        "include_mode": args.include_mode,
        "min_overlap_ratio": max(0.0, min(1.0, args.min_overlap_ratio)),
    }

    resp = requests.post(url, json=payload, timeout=20)
    print("status:", resp.status_code)
    resp.raise_for_status()

    data = resp.json()
    print("type:", data.get("type"))
    print("count:", data.get("count"))

    features = data.get("features") or []
    if features:
        props = features[0].get("properties") or {}
        print("sample_h3_id:", props.get("h3_id"))


if __name__ == "__main__":
    main()
