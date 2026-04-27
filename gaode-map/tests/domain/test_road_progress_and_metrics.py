import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from modules.road.metrics import select_metric_columns
from modules.road.progress import ROAD_SYNTAX_PROGRESS, get_road_syntax_progress, update_road_syntax_progress


def test_select_metric_columns_prefers_shorter_header_for_same_radius():
    chosen = select_metric_columns(
        [
            "Choice R600",
            "Choice R600 [Normalized]",
            "Choice R800",
        ],
        "choice",
        lambda header: "r600" if "R600" in header else "r800",
    )
    assert chosen == {"r600": "Choice R600", "r800": "Choice R800"}


def test_progress_roundtrip_returns_latest_payload():
    ROAD_SYNTAX_PROGRESS.clear()
    update_road_syntax_progress("run-1", stage="fetch", message="working", step=1, total=3)
    payload = get_road_syntax_progress("run-1")
    assert payload is not None
    assert payload["run_id"] == "run-1"
    assert payload["stage"] == "fetch"
    assert payload["step"] == 1
    assert payload["total"] == 3
