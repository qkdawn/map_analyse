import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

import router.domains.history as history_module
from modules.poi.schemas import HistorySaveRequest


def test_save_history_ignores_h3_and_road_snapshots(monkeypatch):
    captured = {}

    def fake_create_record(params, polygon, pois, desc, *, preferred_history_id=""):
        captured["params"] = params
        captured["polygon"] = polygon
        captured["pois"] = pois
        captured["desc"] = desc
        captured["preferred_history_id"] = preferred_history_id
        return 42

    monkeypatch.setattr(history_module.history_repo, "create_record", fake_create_record)

    payload = HistorySaveRequest(
        center=[112.0, 28.0],
        polygon=[[112.0, 28.0], [112.1, 28.1], [112.0, 28.0]],
        drawn_polygon=[[112.0, 28.0], [112.1, 28.1], [112.0, 28.0]],
        pois=[],
        keywords="餐饮",
        mode="walking",
        time_min=15,
        location_name="test",
        source="local",
        h3_result={"grid": {"features": [{"id": "h3-1"}]}},
        road_result={"roads": {"features": [{"id": "road-1"}]}},
    )

    response = asyncio.run(history_module.save_history_manually(payload))

    assert response["status"] == "ok"
    assert response["history_id"] == 42
    assert "h3_result" not in captured["params"]
    assert "road_result" not in captured["params"]
    assert captured["preferred_history_id"] == ""


def test_save_history_prefers_original_wgs84_polygon_when_reusing_history(monkeypatch):
    captured = {}

    def fake_create_record(params, polygon, pois, desc, *, preferred_history_id=""):
        captured["polygon"] = polygon
        captured["preferred_history_id"] = preferred_history_id
        return preferred_history_id or "unexpected"

    monkeypatch.setattr(history_module.history_repo, "create_record", fake_create_record)

    payload = HistorySaveRequest(
        history_id="history-fixed",
        center=[112.0, 28.0],
        polygon=[[112.1, 28.1], [112.2, 28.2], [112.1, 28.1]],
        polygon_wgs84=[[120.1, 30.1], [120.2, 30.2], [120.1, 30.1]],
        pois=[],
        keywords="餐饮",
        mode="walking",
        time_min=15,
        location_name="test",
        source="local",
    )

    response = asyncio.run(history_module.save_history_manually(payload))

    assert response["history_id"] == "history-fixed"
    assert captured["preferred_history_id"] == "history-fixed"
    assert captured["polygon"] == [[120.1, 30.1], [120.2, 30.2], [120.1, 30.1]]
