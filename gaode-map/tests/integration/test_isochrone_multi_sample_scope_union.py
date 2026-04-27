import asyncio

from shapely.geometry import Point, shape

import router.app as app_module
from modules.isochrone.schemas import IsochroneRequest


def test_multi_sample_unions_drawn_scope_with_boundary_isochrones(monkeypatch):
    def fake_get_isochrone_polygon(lat, lon, time_sec, mode):
        return Point(float(lon), float(lat)).buffer(0.00005)

    monkeypatch.setattr(app_module, "get_isochrone_polygon", fake_get_isochrone_polygon)

    payload = IsochroneRequest(
        lat=0.0005,
        lon=0.0005,
        time_min=15,
        mode="walking",
        coord_type="wgs84",
        origin_mode="multi_sample",
        clip_polygon=[
            [0.0, 0.0],
            [0.001, 0.0],
            [0.001, 0.001],
            [0.0, 0.001],
            [0.0, 0.0],
        ],
        clip_output=False,
        sample_boundary_step_m=300,
        sample_inner_step_m=220,
        sample_max_points=None,
    )

    response = asyncio.run(app_module.calculate_isochrone(payload))
    geom = shape(response["geometry"])

    assert geom.covers(Point(0.0005, 0.0005))
    assert response["properties"]["origin_mode"] == "multi_sample"
