#!/usr/bin/env python3
from __future__ import annotations

import argparse
import socket
import sys
import time
import urllib.request
from pathlib import Path
from urllib.error import HTTPError, URLError


AGE_BANDS = [
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download WorldPop China population TIFFs one file at a time.")
    parser.add_argument("years", nargs="+", choices=["2024", "2025", "2026"], help="Dataset year(s)")
    parser.add_argument("--output-dir", required=True, help="Root directory to store year folders and TIFF files")
    parser.add_argument("--skip-existing", action="store_true", help="Skip TIFFs that already exist")
    parser.add_argument("--limit", type=int, default=0, help="Only download the first N files")
    parser.add_argument("--progress-seconds", type=float, default=5.0, help="Progress log interval")
    parser.add_argument("--chunk-size", type=int, default=8 * 1024 * 1024, help="Read size in bytes")
    parser.add_argument("--worker-index", type=int, default=0, help="Zero-based worker index for sharding")
    parser.add_argument("--worker-count", type=int, default=1, help="Total worker count for sharding")
    parser.add_argument("--retry-delay", type=float, default=10.0, help="Seconds to wait before retry")
    parser.add_argument("--max-retries", type=int, default=0, help="Maximum retries per file; 0 means infinite")
    return parser.parse_args()


def build_file_list(year: str) -> list[str]:
    files: list[str] = []
    for sex in ("f", "m", "t"):
        for age in AGE_BANDS:
            files.append(f"chn_{sex}_{age}_{year}_CN_100m_R2025A_v1.tif")
    files.extend(
        [
            f"chn_T_F_{year}_CN_100m_R2025A_v1.tif",
            f"chn_T_M_{year}_CN_100m_R2025A_v1.tif",
        ]
    )
    return files


def format_bytes(value: float) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f}{unit}"
        size /= 1024
    return f"{value}B"


def get_remote_size(url: str) -> int:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Python-urllib/WorldPopTIFFDownloader"},
        method="HEAD",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        total = int(response.headers.get("Content-Length") or 0)
        if total <= 0:
            raise RuntimeError(f"remote size unavailable for {url}")
        return total


def download_one(
    url: str,
    output: Path,
    expected_total: int,
    chunk_size: int,
    progress_seconds: float,
) -> None:
    temp_output = output.with_suffix(output.suffix + ".downloading")
    temp_output.unlink(missing_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Python-urllib/WorldPopTIFFDownloader"})

    started = time.time()
    last_log = started
    written = 0
    with urllib.request.urlopen(request, timeout=60) as response:
        total = int(response.headers.get("Content-Length") or 0)
        if total and expected_total and total != expected_total:
            raise RuntimeError(
                f"content-length mismatch for {output.name}: response={total} expected={expected_total}"
            )
        total = expected_total or total
        print(f"[FILE] {output.name} total={total}", flush=True)
        with temp_output.open("wb") as fh:
            while True:
                chunk = response.read(max(1024, int(chunk_size)))
                if not chunk:
                    break
                fh.write(chunk)
                written += len(chunk)
                now = time.time()
                if now - last_log >= progress_seconds:
                    speed = written / max(now - started, 1e-6)
                    pct = (written / total * 100.0) if total else 0.0
                    print(
                        f"[PROGRESS] {output.name} {written}/{total} bytes ({pct:.2f}%) "
                        f"speed={format_bytes(speed)}/s",
                        flush=True,
                    )
                    last_log = now
    if total and written != total:
        temp_output.unlink(missing_ok=True)
        raise RuntimeError(f"incomplete download for {output.name}: wrote={written} expected={total}")
    temp_output.replace(output)
    elapsed = max(time.time() - started, 1e-6)
    print(
        f"[DONE] {output.name} wrote={written} elapsed={elapsed:.1f}s avg_speed={format_bytes(written / elapsed)}/s",
        flush=True,
    )


def should_skip_existing(output: Path, expected_total: int) -> bool:
    if not output.exists():
        return False
    size = output.stat().st_size
    if size == expected_total and expected_total > 0:
        return True
    print(
        f"[RETRY] removing mismatched existing file {output.name} local={size} expected={expected_total}",
        flush=True,
    )
    output.unlink(missing_ok=True)
    return False


def main() -> int:
    args = parse_args()
    worker_count = max(1, int(args.worker_count or 1))
    worker_index = max(0, int(args.worker_index or 0))
    if worker_index >= worker_count:
        raise SystemExit(f"worker-index must be smaller than worker-count ({worker_index} >= {worker_count})")
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    for year in [str(item) for item in args.years]:
        year_output_dir = output_dir / year
        year_output_dir.mkdir(parents=True, exist_ok=True)
        files = build_file_list(year)
        if args.limit and args.limit > 0:
            files = files[: args.limit]
        files = [name for idx, name in enumerate(files) if idx % worker_count == worker_index]

        base_url = (
            "https://data.worldpop.org/GIS/AgeSex_structures/Global_2015_2030/"
            f"R2025A/{year}/CHN/v1/100m/constrained"
        )

        total_files = len(files)
        print(
            f"[INFO] year={year} files={total_files} output_dir={year_output_dir} "
            f"worker={worker_index + 1}/{worker_count}",
            flush=True,
        )
        for index, name in enumerate(files, start=1):
            output = year_output_dir / name
            url = f"{base_url}/{name}"
            expected_total = get_remote_size(url)
            if args.skip_existing and should_skip_existing(output, expected_total):
                print(f"[SKIP] [{index}/{total_files}] {name}", flush=True)
                continue
            print(f"[START] [{index}/{total_files}] {name}", flush=True)
            attempt = 0
            while True:
                attempt += 1
                try:
                    download_one(url, output, expected_total, args.chunk_size, args.progress_seconds)
                    break
                except (URLError, HTTPError, TimeoutError, socket.timeout, RuntimeError, OSError) as exc:
                    limit = int(args.max_retries or 0)
                    print(
                        f"[ERROR] {name} attempt={attempt} error={exc.__class__.__name__}: {exc}",
                        flush=True,
                    )
                    if limit > 0 and attempt >= limit:
                        raise
                    time.sleep(max(1.0, float(args.retry_delay or 10.0)))

    print("[ALL DONE] completed requested TIFF downloads", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
