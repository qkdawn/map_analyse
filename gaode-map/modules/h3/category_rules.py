from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CategoryKey = str
CategoryRule = Tuple[CategoryKey, str, Tuple[str, ...]]

_TYPE_MAP_PATH = Path(__file__).resolve().parents[2] / "share" / "type_map.json"


def normalize_typecode(value: Any) -> str:
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) >= 6:
        return digits[:6]
    return digits


def build_category_rules() -> List[CategoryRule]:
    try:
        raw = json.loads(_TYPE_MAP_PATH.read_text(encoding="utf-8"))
        groups = raw.get("groups") or []
        rules: List[CategoryRule] = []
        for idx, group in enumerate(groups):
            key = str(group.get("id") or f"group-{idx + 1}")
            label = str(group.get("title") or key)
            codes: List[str] = []
            for item in (group.get("items") or []):
                for code in str(item.get("types") or "").split("|"):
                    normalized = normalize_typecode(code)
                    if normalized:
                        codes.append(normalized)
            deduped_codes: List[str] = []
            seen = set()
            for code in codes:
                if code in seen:
                    continue
                seen.add(code)
                deduped_codes.append(code)
            rules.append((key, label, tuple(deduped_codes)))
        if rules:
            return rules
    except Exception:
        pass

    return [
        ("group-7", "餐饮", ("05",)),
        ("group-6", "购物", ("06",)),
        ("group-4", "商务住宅", ("12",)),
        ("group-3", "交通", ("15",)),
        ("group-2", "旅游", ("11",)),
        ("group-13", "科教文化", ("14",)),
        ("group-10", "医疗", ("09",)),
    ]


CATEGORY_RULES: List[CategoryRule] = build_category_rules()
CATEGORY_KEYS: Tuple[str, ...] = tuple(item[0] for item in CATEGORY_RULES)
_TYPECODE_TO_CATEGORY: Dict[str, str] = {}
_PREFIX2_TO_CATEGORY: Dict[str, str] = {}
for category_key, _label, typecodes in CATEGORY_RULES:
    for code in typecodes:
        _TYPECODE_TO_CATEGORY.setdefault(code, category_key)
        if len(code) >= 2:
            _PREFIX2_TO_CATEGORY.setdefault(code[:2], category_key)


def empty_category_counts() -> Dict[CategoryKey, int]:
    return {key: 0 for key in CATEGORY_KEYS}


def infer_category_key(type_text: Optional[str]) -> Optional[CategoryKey]:
    if not type_text:
        return None
    code = normalize_typecode(type_text)
    if len(code) < 2:
        return None
    if code in _TYPECODE_TO_CATEGORY:
        return _TYPECODE_TO_CATEGORY[code]
    return _PREFIX2_TO_CATEGORY.get(code[:2])
