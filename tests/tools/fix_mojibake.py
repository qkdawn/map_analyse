from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


MOJIBAKE_MARKERS = (
    "鍖",
    "涓",
    "瑗",
    "鏍",
    "绫",
    "闄",
    "灞",
    "鎴",
    "鐢",
    "澶",
    "骞",
    "璇",
    "缁",
    "锛",
    "銆",
    "€",
)

SKIP_PREFIXES = (
    ".tmp-render-fn.js",
    "tests/domain/test_encoding_guard.py",
    "tests/tools/fix_mojibake.py",
    ".git/",
    ".venv/",
    "gaode-map/",
    "host_bridge/",
    "runtime/",
    "search/",
    "static/vendor/",
    "static/frontend/assets/",
    "frontend/node_modules/",
)

TEXT_SUFFIXES = {
    ".py",
    ".md",
    ".js",
    ".ts",
    ".vue",
    ".html",
    ".css",
    ".json",
}


def git_files() -> list[str]:
    output = subprocess.check_output(["git", "ls-files"], text=True, encoding="utf-8")
    return [line.strip() for line in output.splitlines() if line.strip()]


def should_scan(path: str) -> bool:
    normalized = path.replace("\\", "/")
    if normalized.startswith(SKIP_PREFIXES):
        return False
    return Path(normalized).suffix.lower() in TEXT_SUFFIXES


def marker_score(text: str) -> int:
    return sum(text.count(marker) for marker in MOJIBAKE_MARKERS)


def chinese_score(text: str) -> int:
    return sum(1 for char in text if "\u4e00" <= char <= "\u9fff")


def repair_text(text: str) -> str | None:
    candidates: list[tuple[int, int, str]] = []
    for encoding in ("cp936", "gbk"):
        try:
            repaired = text.encode(encoding).decode("utf-8")
        except UnicodeError:
            continue
        before_markers = marker_score(text)
        after_markers = marker_score(repaired)
        before_chinese = chinese_score(text)
        after_chinese = chinese_score(repaired)
        if before_markers <= 0:
            continue
        if after_markers * 4 <= before_markers and after_chinese >= before_chinese:
            candidates.append((after_markers, -after_chinese, repaired))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]))
    return candidates[0][2]


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair high-confidence UTF-8/CP936 mojibake in tracked source files.")
    parser.add_argument("--write", action="store_true", help="Write repaired files. Without this flag, only report.")
    args = parser.parse_args()

    changed: list[str] = []
    skipped: list[str] = []
    for name in git_files():
        if not should_scan(name):
            continue
        path = Path(name)
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            skipped.append(name)
            continue
        if marker_score(text) <= 0:
            continue
        repaired = repair_text(text)
        if repaired is None or repaired == text:
            skipped.append(name)
            continue
        changed.append(name)
        print(f"FIX {name}: markers {marker_score(text)} -> {marker_score(repaired)}, chinese {chinese_score(text)} -> {chinese_score(repaired)}")
        if args.write:
            path.write_text(repaired, encoding="utf-8", newline="")

    if skipped:
        print("SKIP")
        for name in skipped:
            print(name)
    print(f"SUMMARY changed={len(changed)} skipped={len(skipped)} write={args.write}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
