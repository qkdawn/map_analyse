#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock


BASE_URL = (
    "https://data.worldpop.org/GIS/AgeSex_structures/Global_2015_2030/"
    "R2025A/2026/CHN/v1/100m/constrained"
)

BAD_FILES = [
    "chn_T_F_2026_CN_100m_R2025A_v1.tif",
    "chn_f_00_2026_CN_100m_R2025A_v1.tif",
    "chn_f_01_2026_CN_100m_R2025A_v1.tif",
    "chn_f_05_2026_CN_100m_R2025A_v1.tif",
    "chn_m_25_2026_CN_100m_R2025A_v1.tif",
    "chn_m_40_2026_CN_100m_R2025A_v1.tif",
    "chn_m_45_2026_CN_100m_R2025A_v1.tif",
    "chn_m_55_2026_CN_100m_R2025A_v1.tif",
    "chn_m_60_2026_CN_100m_R2025A_v1.tif",
    "chn_m_70_2026_CN_100m_R2025A_v1.tif",
    "chn_m_80_2026_CN_100m_R2025A_v1.tif",
    "chn_m_85_2026_CN_100m_R2025A_v1.tif",
    "chn_m_90_2026_CN_100m_R2025A_v1.tif",
    "chn_t_00_2026_CN_100m_R2025A_v1.tif",
    "chn_t_01_2026_CN_100m_R2025A_v1.tif",
    "chn_t_05_2026_CN_100m_R2025A_v1.tif",
    "chn_t_10_2026_CN_100m_R2025A_v1.tif",
    "chn_t_15_2026_CN_100m_R2025A_v1.tif",
    "chn_t_20_2026_CN_100m_R2025A_v1.tif",
    "chn_t_25_2026_CN_100m_R2025A_v1.tif",
    "chn_t_30_2026_CN_100m_R2025A_v1.tif",
    "chn_t_35_2026_CN_100m_R2025A_v1.tif",
    "chn_t_40_2026_CN_100m_R2025A_v1.tif",
    "chn_t_45_2026_CN_100m_R2025A_v1.tif",
    "chn_t_50_2026_CN_100m_R2025A_v1.tif",
    "chn_t_55_2026_CN_100m_R2025A_v1.tif",
    "chn_t_60_2026_CN_100m_R2025A_v1.tif",
    "chn_t_65_2026_CN_100m_R2025A_v1.tif",
    "chn_t_70_2026_CN_100m_R2025A_v1.tif",
    "chn_t_75_2026_CN_100m_R2025A_v1.tif",
    "chn_t_80_2026_CN_100m_R2025A_v1.tif",
    "chn_t_85_2026_CN_100m_R2025A_v1.tif",
    "chn_t_90_2026_CN_100m_R2025A_v1.tif",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Redownload bad WorldPop TIFF files.")
    parser.add_argument(
        "data_dir",
        nargs="?",
        default="/mnt/e/PeopleData",
        help="Directory to store the TIFF files",
    )
    parser.add_argument(
        "--timestamp",
        default="20260314",
        help="Suffix for backing up replaced files",
    )
    parser.add_argument(
        "--curl-bin",
        default="curl",
        help="curl executable path",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Only process the first N bad files (0 means all)",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=4,
        help="Number of files to download in parallel",
    )
    return parser.parse_args()


def _curl_cmd(curl_bin: str, url: str, out_path: Path) -> list[str]:
    cmd = [
        curl_bin,
        "-L",
        "--fail",
        "--retry",
        "5",
        "--retry-delay",
        "5",
        "--retry-all-errors",
        "--progress-bar",
        url,
        "-o",
        str(out_path),
    ]
    return cmd


def run_curl(curl_bin: str, url: str, out_path: Path) -> None:
    out_path.unlink(missing_ok=True)
    cmd = _curl_cmd(curl_bin, url, out_path)
    subprocess.run(cmd, check=True)


def _download_one(
    index: int,
    total: int,
    name: str,
    data_dir: Path,
    curl_bin: str,
    timestamp: str,
    print_lock: Lock,
) -> tuple[str, bool, str]:
    url = f"{BASE_URL}/{name}"
    target = data_dir / name
    temp_path = data_dir / f"{name}.download"
    backup_path = data_dir / f"{name}.corrupt-{timestamp}"
    with print_lock:
        print(f"[{index}/{total}] downloading {name}", flush=True)
    try:
        run_curl(curl_bin, url, temp_path)
        if target.exists():
            if backup_path.exists():
                backup_path.unlink()
            target.rename(backup_path)
        temp_path.rename(target)
        with print_lock:
            print(f"[OK] replaced {name}", flush=True)
        return name, True, ""
    except subprocess.CalledProcessError as exc:
        with print_lock:
            print(f"[FAIL] download failed: {name} ({exc})", flush=True)
        return name, False, str(exc)
    except Exception as exc:
        with print_lock:
            print(f"[FAIL] unexpected error: {name} ({exc})", flush=True)
        return name, False, str(exc)


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir).expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)

    selected = BAD_FILES[: args.limit] if args.limit and args.limit > 0 else BAD_FILES
    total = len(selected)
    if not selected:
        print("[INFO] no files selected")
        return 0
    jobs = max(1, int(args.jobs or 1))
    print(f"[INFO] parallel jobs: {jobs}", flush=True)
    print_lock = Lock()
    failures: list[tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=jobs) as executor:
        futures = [
            executor.submit(
                _download_one,
                index,
                total,
                name,
                data_dir,
                args.curl_bin,
                args.timestamp,
                print_lock,
            )
            for index, name in enumerate(selected, start=1)
        ]
        for future in as_completed(futures):
            name, ok, error = future.result()
            if not ok:
                failures.append((name, error))

    if failures:
        print("[RESULT] some files failed:", flush=True)
        for name, error in failures:
            print(f"  - {name}: {error}", flush=True)
        return 1

    print("[DONE] selected bad files redownloaded", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
