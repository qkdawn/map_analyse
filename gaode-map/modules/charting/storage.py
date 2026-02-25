from __future__ import annotations

import os
import uuid


CHART_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "generated_charts")
os.makedirs(CHART_DIR, exist_ok=True)


def save_svg(svg_content: str) -> tuple[str, str]:
    chart_id = uuid.uuid4().hex
    filename = f"{chart_id}.svg"
    filepath = os.path.join(CHART_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as handle:
        handle.write(svg_content)
    return chart_id, filename


def save_png(png_bytes: bytes) -> tuple[str, str]:
    chart_id = uuid.uuid4().hex
    filename = f"{chart_id}.png"
    filepath = os.path.join(CHART_DIR, filename)
    with open(filepath, "wb") as handle:
        handle.write(png_bytes)
    return chart_id, filename


def get_chart_path(filename: str) -> str:
    safe_name = os.path.basename(filename)
    return os.path.join(CHART_DIR, safe_name)
