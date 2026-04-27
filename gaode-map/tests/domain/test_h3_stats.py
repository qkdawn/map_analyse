import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from modules.h3.stats import build_lisa_render_meta, calc_continuous_stats, shannon_entropy


def test_calc_continuous_stats_ignores_none_values():
    stats = calc_continuous_stats([1.0, None, 3.0])
    assert stats["count"] == 2
    assert stats["mean"] == 2.0
    assert stats["min"] == 1.0
    assert stats["max"] == 3.0


def test_build_lisa_render_meta_marks_low_variance_as_degraded():
    meta = build_lisa_render_meta({"count": 1, "mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0})
    assert meta["mode"] == "stddev"
    assert meta["degraded"] is True
    assert "message" in meta


def test_shannon_entropy_zero_for_single_bucket():
    assert shannon_entropy({"a": 5, "b": 0}) == 0.0
