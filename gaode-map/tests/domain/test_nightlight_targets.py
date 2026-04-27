import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
sys.path.append(str(Path(__file__).resolve().parents[1]))

from modules.nightlight.targets import load_target_cells  # noqa: E402
from nightlight_test_utils import configure_nightlight_dir, sample_gcj02_polygon  # noqa: E402


def test_load_target_cells_from_population_grid(tmp_path):
    configure_nightlight_dir(tmp_path, year=2025)

    cells = load_target_cells(sample_gcj02_polygon(), "gcj02")

    assert len(cells) == 16
    first = cells[0]
    assert first.cell_id
    assert first.feature is not None
    assert first.geometry_gcj02
    assert first.geometry_wgs84.is_empty is False
    assert len(first.centroid_gcj02) == 2
