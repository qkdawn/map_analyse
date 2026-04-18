from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Literal


SexKey = Literal["total", "male", "female"]
AgeBandKey = Literal[
    "all",
    "00",
    "01",
    "05",
    "10",
    "15",
    "20",
    "25",
    "30",
    "35",
    "40",
    "45",
    "50",
    "55",
    "60",
    "65",
    "70",
    "75",
    "80",
    "85",
    "90",
]


DEFAULT_SEX: SexKey = "total"
DEFAULT_AGE_BAND: AgeBandKey = "all"
DEFAULT_POPULATION_YEAR = "2026"
POPULATION_YEAR_OPTIONS: tuple[str, ...] = ("2024", "2025", "2026")


SEX_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "total", "label": "总人口"},
    {"value": "male", "label": "男性"},
    {"value": "female", "label": "女性"},
)


AGE_BAND_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "all", "label": "全年龄"},
    {"value": "00", "label": "0岁"},
    {"value": "01", "label": "1-4岁"},
    {"value": "05", "label": "5-9岁"},
    {"value": "10", "label": "10-14岁"},
    {"value": "15", "label": "15-19岁"},
    {"value": "20", "label": "20-24岁"},
    {"value": "25", "label": "25-29岁"},
    {"value": "30", "label": "30-34岁"},
    {"value": "35", "label": "35-39岁"},
    {"value": "40", "label": "40-44岁"},
    {"value": "45", "label": "45-49岁"},
    {"value": "50", "label": "50-54岁"},
    {"value": "55", "label": "55-59岁"},
    {"value": "60", "label": "60-64岁"},
    {"value": "65", "label": "65-69岁"},
    {"value": "70", "label": "70-74岁"},
    {"value": "75", "label": "75-79岁"},
    {"value": "80", "label": "80-84岁"},
    {"value": "85", "label": "85-89岁"},
    {"value": "90", "label": "90岁及以上"},
)

_AGE_LABEL_MAP: dict[str, str] = {item["value"]: item["label"] for item in AGE_BAND_OPTIONS}
_SEX_LABEL_MAP: dict[str, str] = {item["value"]: item["label"] for item in SEX_OPTIONS}


@dataclass(frozen=True)
class PopulationLayer:
    sex: SexKey
    age_band: AgeBandKey
    year: str
    filename: str
    label: str


def get_age_band_label(age_band: str) -> str:
    return _AGE_LABEL_MAP.get(str(age_band), str(age_band))


def get_sex_label(sex: str) -> str:
    return _SEX_LABEL_MAP.get(str(sex), str(sex))


def normalize_population_year(year: str | int | None) -> str:
    safe_year = str(year or DEFAULT_POPULATION_YEAR).strip()
    if safe_year in POPULATION_YEAR_OPTIONS:
        return safe_year
    return DEFAULT_POPULATION_YEAR


def _file_name_for_layer(
    sex: SexKey,
    age_band: AgeBandKey,
    year: str = DEFAULT_POPULATION_YEAR,
) -> str:
    safe_year = normalize_population_year(year)
    if age_band == "all":
        if sex == "male":
            return f"chn_T_M_{safe_year}_CN_100m_R2025A_v1.tif"
        if sex == "female":
            return f"chn_T_F_{safe_year}_CN_100m_R2025A_v1.tif"
        raise ValueError("total/all is represented by two sex-specific total files")

    prefix_map = {
        "male": "m",
        "female": "f",
        "total": "t",
    }
    return f"chn_{prefix_map[sex]}_{age_band}_{safe_year}_CN_100m_R2025A_v1.tif"


def resolve_population_layers(
    sex: SexKey,
    age_band: AgeBandKey,
    year: str = DEFAULT_POPULATION_YEAR,
) -> list[PopulationLayer]:
    safe_year = normalize_population_year(year)
    if age_band == "all" and sex == "total":
        return [
            PopulationLayer(
                sex="male",
                age_band="all",
                year=safe_year,
                filename=_file_name_for_layer("male", "all", safe_year),
                label="男性总人口",
            ),
            PopulationLayer(
                sex="female",
                age_band="all",
                year=safe_year,
                filename=_file_name_for_layer("female", "all", safe_year),
                label="女性总人口",
            ),
        ]
    filename = _file_name_for_layer(sex, age_band, safe_year)
    label = f"{get_sex_label(sex)} {get_age_band_label(age_band)}"
    return [PopulationLayer(sex=sex, age_band=age_band, year=safe_year, filename=filename, label=label)]


def age_band_keys() -> list[str]:
    return [item["value"] for item in AGE_BAND_OPTIONS if item["value"] != "all"]


def resolve_population_file_paths(
    data_dir: str | Path,
    sex: SexKey,
    age_band: AgeBandKey,
    year: str = DEFAULT_POPULATION_YEAR,
) -> list[Path]:
    base_dir = Path(data_dir).expanduser().resolve()
    return [base_dir / layer.filename for layer in resolve_population_layers(sex, age_band, year)]


def resolve_population_data_dir(
    data_dir: str | Path,
    year: str = DEFAULT_POPULATION_YEAR,
) -> Path:
    base_dir = Path(data_dir).expanduser().resolve()
    return (base_dir / normalize_population_year(year)).resolve()


def build_meta_payload() -> Dict[str, object]:
    return {
        "sex_options": [dict(item) for item in SEX_OPTIONS],
        "age_band_options": [dict(item) for item in AGE_BAND_OPTIONS],
        "default_sex": DEFAULT_SEX,
        "default_age_band": DEFAULT_AGE_BAND,
        "default_year": DEFAULT_POPULATION_YEAR,
        "year_options": list(POPULATION_YEAR_OPTIONS),
    }


def build_selected_descriptor(sex: SexKey, age_band: AgeBandKey) -> Dict[str, str]:
    return {
        "sex": sex,
        "sex_label": get_sex_label(sex),
        "age_band": age_band,
        "age_band_label": get_age_band_label(age_band),
    }
