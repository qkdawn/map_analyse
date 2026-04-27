import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from modules.h3.category_rules import CATEGORY_KEYS, empty_category_counts, infer_category_key, normalize_typecode


def test_normalize_typecode_keeps_first_six_digits():
    assert normalize_typecode("05-0000 餐饮") == "050000"


def test_infer_category_key_supports_exact_and_prefix_match():
    assert infer_category_key("050000") in CATEGORY_KEYS
    assert infer_category_key("05") in CATEGORY_KEYS
    assert infer_category_key("unknown") is None


def test_empty_category_counts_matches_declared_keys():
    counts = empty_category_counts()
    assert tuple(counts.keys()) == CATEGORY_KEYS
    assert all(value == 0 for value in counts.values())
