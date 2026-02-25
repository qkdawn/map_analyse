from __future__ import annotations

import html
import math


def _nice_max(value: float) -> float:
    if value <= 0:
        return 1.0
    exp = math.floor(math.log10(value))
    base = 10 ** exp
    for factor in (1, 2, 5, 10):
        if value <= factor * base:
            return factor * base
    return 10 * base


def _compute_ticks(max_value: float, tick_count: int = 5) -> list[float]:
    nice_max = _nice_max(max_value)
    step = nice_max / tick_count
    return [step * i for i in range(tick_count + 1)]


def _prepare_labels(labels: list[str], max_count: int = 12) -> tuple[list[str], int]:
    if len(labels) <= max_count:
        return labels, 1
    stride = math.ceil(len(labels) / max_count)
    trimmed = [label if idx % stride == 0 else "" for idx, label in enumerate(labels)]
    return trimmed, stride


def build_svg(
    labels: list[str],
    series: list[str],
    values: list[list[float]],
    x_title: str = "",
) -> str:
    width = 980
    height = 560
    padding_left = 80
    padding_right = 30
    padding_top = 50
    padding_bottom = 110
    plot_width = width - padding_left - padding_right
    plot_height = height - padding_top - padding_bottom

    max_value = max((max(series_values) for series_values in values), default=1.0)
    max_value = max(max_value, 1.0)
    y_ticks = _compute_ticks(max_value)
    y_max = y_ticks[-1] if y_ticks else max_value

    group_count = max(len(labels), 1)
    series_count = max(len(series), 1)
    group_width = plot_width / group_count
    bar_width = group_width / series_count * 0.72
    colors = ["#4c78a8", "#f58518", "#54a24b", "#e45756", "#72b7b2"]

    svg_parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">',
        '<rect width="100%" height="100%" fill="#f8f6f2" />',
    ]

    x_axis_y = padding_top + plot_height
    svg_parts.append(
        f'<line x1="{padding_left}" y1="{x_axis_y}" x2="{padding_left + plot_width}" y2="{x_axis_y}" '
        'stroke="#2f2f2f" stroke-width="1.2" />'
    )
    svg_parts.append(
        f'<line x1="{padding_left}" y1="{padding_top}" x2="{padding_left}" y2="{x_axis_y}" '
        'stroke="#2f2f2f" stroke-width="1.2" />'
    )

    for tick in y_ticks:
        y_pos = x_axis_y - (tick / y_max) * plot_height
        svg_parts.append(
            f'<line x1="{padding_left - 6}" y1="{y_pos:.2f}" x2="{padding_left}" y2="{y_pos:.2f}" '
            'stroke="#2f2f2f" stroke-width="1" />'
        )
        svg_parts.append(
            f'<text x="{padding_left - 10}" y="{y_pos + 4:.2f}" text-anchor="end" '
            'font-size="12" fill="#2f2f2f" font-family="sans-serif">'
            f"{tick:g}</text>"
        )

    trimmed_labels, _ = _prepare_labels(labels)

    for i, label in enumerate(labels):
        group_x = padding_left + i * group_width
        for s_idx, series_values in enumerate(values):
            value = series_values[i] if i < len(series_values) else 0.0
            bar_height = (value / y_max) * plot_height
            bar_x = group_x + s_idx * bar_width + (group_width - bar_width * series_count) / 2
            bar_y = x_axis_y - bar_height
            color = colors[s_idx % len(colors)]
            svg_parts.append(
                f'<rect x="{bar_x:.2f}" y="{bar_y:.2f}" width="{bar_width:.2f}" height="{bar_height:.2f}" '
                f'fill="{color}" />'
            )

        safe_label = html.escape(trimmed_labels[i]) if i < len(trimmed_labels) else ""
        if safe_label:
            label_x = group_x + group_width / 2
            svg_parts.append(
                f'<text x="{label_x:.2f}" y="{x_axis_y + 42}" text-anchor="end" '
                'font-size="11" fill="#2f2f2f" font-family="sans-serif" '
                f'transform="rotate(-35 {label_x:.2f} {x_axis_y + 42})">{safe_label}</text>'
            )

    legend_x = padding_left
    legend_y = padding_top - 22
    for s_idx, series_name in enumerate(series):
        color = colors[s_idx % len(colors)]
        safe_name = html.escape(series_name)
        x_offset = legend_x + s_idx * 160
        svg_parts.append(
            f'<rect x="{x_offset}" y="{legend_y}" width="12" height="12" fill="{color}" />'
        )
        svg_parts.append(
            f'<text x="{x_offset + 18}" y="{legend_y + 11}" font-size="12" fill="#2f2f2f" '
            f'font-family="sans-serif">{safe_name}</text>'
        )

    if x_title:
        safe_title = html.escape(x_title)
        svg_parts.append(
            f'<text x="{padding_left + plot_width}" y="{padding_top - 6}" text-anchor="end" '
            'font-size="12" fill="#2f2f2f" font-family="sans-serif">'
            f"{safe_title}</text>"
        )

    svg_parts.append("</svg>")
    return "\n".join(svg_parts)
