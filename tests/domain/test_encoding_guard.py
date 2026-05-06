from __future__ import annotations

import subprocess
from pathlib import Path


MOJIBAKE_MARKERS = ("鍖", "涓", "瑗", "鏍", "绫", "闄", "灞", "鎴", "鐢", "锛", "銆")

SKIP_PREFIXES = (
    ".tmp-render-fn.js",
    "tests/domain/test_encoding_guard.py",
    "tests/tools/fix_mojibake.py",
    "static/vendor/",
    "static/frontend/assets/",
    "frontend/node_modules/",
    "runtime/",
)

TEXT_SUFFIXES = {".py", ".md", ".js", ".ts", ".vue", ".html", ".css", ".json"}


def _tracked_text_files() -> list[str]:
    output = subprocess.check_output(["git", "ls-files"], text=True, encoding="utf-8")
    files = []
    for name in output.splitlines():
        normalized = name.replace("\\", "/")
        if normalized.startswith(SKIP_PREFIXES):
            continue
        if Path(normalized).suffix.lower() in TEXT_SUFFIXES:
            files.append(normalized)
    return files


def test_tracked_source_files_do_not_contain_common_chinese_mojibake_markers():
    offenders = []
    for name in _tracked_text_files():
        path = Path(name)
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        hits = sum(text.count(marker) for marker in MOJIBAKE_MARKERS)
        if hits >= 2:
            offenders.append(f"{name}:{hits}")

    assert offenders == []
