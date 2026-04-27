#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import sys
from pathlib import Path


AGES = [
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


def build_expected_names(year: str) -> list[str]:
    names: list[str] = []
    for sex in ("f", "m", "t"):
        for age in AGES:
            names.append(f"chn_{sex}_{age}_{year}_CN_100m_R2025A_v1.tif")
    names.extend(
        [
            f"chn_T_F_{year}_CN_100m_R2025A_v1.tif",
            f"chn_T_M_{year}_CN_100m_R2025A_v1.tif",
        ]
    )
    return sorted(names)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check whether a CN 100m population raster set is complete."
    )
    parser.add_argument("data_dir", help="Directory containing the population TIFF files")
    parser.add_argument(
        "--year",
        default="2026",
        choices=["2024", "2025", "2026"],
        help="Dataset year to check",
    )
    parser.add_argument(
        "--probe-bytes",
        type=int,
        default=4096,
        help="Bytes to read from the start/middle/end of each file",
    )
    parser.add_argument(
        "--sha256",
        action="store_true",
        help="Compute SHA256 for each TIFF file (slow, useful for a manifest)",
    )
    parser.add_argument(
        "--skip-rasterio",
        action="store_true",
        help="Skip opening TIFFs with rasterio/GDAL",
    )
    return parser.parse_args()


def human_size(size: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.2f} {unit}"
        value /= 1024
    return f"{size} B"


def check_tiff_structure(path: Path, probe_bytes: int) -> list[str]:
    issues: list[str] = []
    size = path.stat().st_size
    if size == 0:
        return ["empty file"]

    with path.open("rb") as fh:
        header = fh.read(16)
        if len(header) < 8:
            return ["header too short"]

        order = header[:2]
        if order == b"II":
            endian = "little"
        elif order == b"MM":
            endian = "big"
        else:
            return [f"invalid byte order marker: {order!r}"]

        version = int.from_bytes(header[2:4], endian)
        if version == 42:
            if len(header) < 8:
                return ["classic TIFF header too short"]
            first_ifd_offset = int.from_bytes(header[4:8], endian)
            entry_count_size = 2
            entry_size = 12
            next_offset_size = 4
        elif version == 43:
            if len(header) < 16:
                return ["BigTIFF header too short"]
            offset_size = int.from_bytes(header[4:6], endian)
            reserved = int.from_bytes(header[6:8], endian)
            if offset_size != 8:
                issues.append(f"unexpected BigTIFF offset size: {offset_size}")
            if reserved != 0:
                issues.append(f"unexpected BigTIFF reserved field: {reserved}")
            first_ifd_offset = int.from_bytes(header[8:16], endian)
            entry_count_size = 8
            entry_size = 20
            next_offset_size = 8
        else:
            return [f"unsupported TIFF version: {version}"]

        if first_ifd_offset <= 0 or first_ifd_offset >= size:
            issues.append(f"first IFD offset out of range: {first_ifd_offset}")
            return issues

        fh.seek(first_ifd_offset)
        raw_count = fh.read(entry_count_size)
        if len(raw_count) != entry_count_size:
            issues.append("cannot read IFD entry count")
            return issues

        entry_count = int.from_bytes(raw_count, endian)
        directory_span = entry_count_size + (entry_count * entry_size) + next_offset_size
        if first_ifd_offset + directory_span > size:
            issues.append(
                "IFD directory exceeds file size "
                f"(offset={first_ifd_offset}, entries={entry_count})"
            )

        probes = [0, max(0, size // 2 - probe_bytes // 2), max(0, size - probe_bytes)]
        for probe_offset in probes:
            fh.seek(probe_offset)
            chunk = fh.read(min(probe_bytes, size - probe_offset))
            if not chunk:
                issues.append(f"failed to read probe at {probe_offset}")
                break

    return issues


def sha256sum(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def rasterio_open_issue(path: Path) -> str | None:
    import rasterio

    try:
        with rasterio.open(path) as src:
            _ = src.count
            _ = src.width
            _ = src.height
            _ = src.dtypes
        return None
    except Exception as exc:
        return f"{exc.__class__.__name__}: {exc}"


def has_rasterio() -> bool:
    return importlib.util.find_spec("rasterio") is not None


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data_dir).expanduser().resolve()
    if not data_dir.is_dir():
        print(f"[ERROR] not a directory: {data_dir}")
        return 2

    expected = set(build_expected_names(str(args.year)))
    tifs = sorted(p for p in data_dir.glob("*.tif") if p.is_file())
    aria2_files = sorted(p for p in data_dir.glob("*.aria2") if p.is_file())
    actual_names = {p.name for p in tifs}

    missing = sorted(expected - actual_names)
    extra = sorted(actual_names - expected)

    print(f"[INFO] directory: {data_dir}")
    print(f"[INFO] expected tif count: {len(expected)}")
    print(f"[INFO] actual tif count:   {len(tifs)}")
    print(f"[INFO] aria2 count:        {len(aria2_files)}")

    if tifs:
        sizes = [p.stat().st_size for p in tifs]
        print(
            "[INFO] tif sizes: "
            f"min={human_size(min(sizes))}, "
            f"max={human_size(max(sizes))}, "
            f"total={human_size(sum(sizes))}"
        )

    if missing:
        print("[FAIL] missing TIFF files:")
        for name in missing:
            print(f"  - {name}")

    if extra:
        print("[FAIL] unexpected TIFF files:")
        for name in extra:
            print(f"  - {name}")

    if aria2_files:
        print("[WARN] leftover .aria2 files found:")
        for path in aria2_files:
            print(f"  - {path.name}")

    rasterio_available = (not args.skip_rasterio) and has_rasterio()
    if not args.skip_rasterio and not rasterio_available:
        print("[WARN] rasterio is not installed; skipping rasterio/GDAL open checks")

    bad_files: list[tuple[str, list[str]]] = []
    for tif in tifs:
        issues = check_tiff_structure(tif, probe_bytes=args.probe_bytes)
        if rasterio_available:
            rasterio_issue = rasterio_open_issue(tif)
            if rasterio_issue:
                issues.append(rasterio_issue)
        if issues:
            bad_files.append((tif.name, issues))

    if bad_files:
        print("[FAIL] TIFF readability/structure issues:")
        for name, issues in bad_files:
            print(f"  - {name}")
            for issue in issues:
                print(f"    * {issue}")
        print(f"[INFO] bad tif count: {len(bad_files)} / {len(tifs)}")
    else:
        check_mode = "header/probe/rasterio" if rasterio_available else "header/probe"
        print(f"[PASS] all TIFF files passed {check_mode} checks")

    if args.sha256 and tifs:
        print("[INFO] computing SHA256 manifest")
        for tif in tifs:
            digest = sha256sum(tif)
            print(f"{digest}  {tif.name}")

    has_failure = bool(missing or extra or bad_files)
    has_warning = bool(aria2_files)

    if has_failure:
        print("[RESULT] dataset is NOT complete")
        return 1
    if has_warning:
        print("[RESULT] dataset structure looks complete, but leftover .aria2 files need manual confirmation")
        return 0

    print("[RESULT] dataset looks complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
