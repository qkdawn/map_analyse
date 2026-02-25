from __future__ import annotations

import re
from typing import Iterable

from fastapi import HTTPException


def _parse_number(value: str) -> float | None:
    match = re.search(r"-?\d+(?:\.\d+)?", value)
    if not match:
        return None
    try:
        return float(match.group())
    except ValueError:
        return None


def _is_separator_row(cells: Iterable[str]) -> bool:
    for cell in cells:
        if not re.fullmatch(r"[:\-\s]+", cell):
            return False
    return True


def _extract_tables(text: str) -> list[list[list[str]]]:
    tables: list[list[str]] = []
    current: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if "|" in line:
            current.append(line)
        else:
            if current:
                tables.append(current)
                current = []
    if current:
        tables.append(current)

    parsed_tables: list[list[list[str]]] = []
    for table_lines in tables:
        rows: list[list[str]] = []
        for line in table_lines:
            if "|" not in line:
                continue
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) < 2:
                continue
            rows.append(cells)
        if rows:
            parsed_tables.append(rows)
    return parsed_tables


def pick_numeric_table(text: str) -> tuple[str, list[str], list[str], list[list[float]]]:
    tables = _extract_tables(text)
    best: tuple[str, list[str], list[str], list[list[float]]] | None = None

    for rows in tables:
        if len(rows) < 2:
            continue
        header = rows[0]
        data_rows = rows[1:]
        if _is_separator_row(data_rows[0]):
            data_rows = data_rows[1:]
        if not data_rows:
            continue

        col_count = max(len(header), max(len(r) for r in data_rows))
        header = header + [f"series_{i}" for i in range(len(header), col_count)]

        numeric_cols: list[int] = []
        for col_idx in range(1, col_count):
            numeric_count = 0
            for row in data_rows:
                if col_idx >= len(row):
                    continue
                if _parse_number(row[col_idx]) is not None:
                    numeric_count += 1
            if numeric_count >= max(1, len(data_rows) // 2):
                numeric_cols.append(col_idx)

        if not numeric_cols:
            continue

        labels = [row[0] if row else "" for row in data_rows]
        series_names = [header[idx] for idx in numeric_cols]
        series_values: list[list[float]] = []
        for col_idx in numeric_cols:
            values: list[float] = []
            for row in data_rows:
                if col_idx >= len(row):
                    values.append(0.0)
                    continue
                parsed = _parse_number(row[col_idx])
                values.append(parsed if parsed is not None else 0.0)
            series_values.append(values)

        x_title = header[0] if header else ""
        best = (x_title, labels, series_names, series_values)
        break

    if best is None:
        raise HTTPException(status_code=400, detail="No numeric table found in input.")
    return best
