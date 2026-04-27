import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from modules.population.registry import resolve_population_layers


def test_population_registry_total_all_uses_total_files():
    layers = resolve_population_layers("total", "all")
    filenames = [layer.filename for layer in layers]
    assert filenames == [
        "chn_T_M_2026_CN_100m_R2025A_v1.tif",
        "chn_T_F_2026_CN_100m_R2025A_v1.tif",
    ]


def test_population_registry_age_specific_mappings():
    assert resolve_population_layers("male", "25")[0].filename == "chn_m_25_2026_CN_100m_R2025A_v1.tif"
    assert resolve_population_layers("female", "40")[0].filename == "chn_f_40_2026_CN_100m_R2025A_v1.tif"
    assert resolve_population_layers("total", "90")[0].filename == "chn_t_90_2026_CN_100m_R2025A_v1.tif"
