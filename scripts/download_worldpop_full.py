#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.request
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download a large WorldPop file without range requests.")
    parser.add_argument("url", help="Source URL")
    parser.add_argument("output", help="Destination file path")
    parser.add_argument("--chunk-size", type=int, default=8 * 1024 * 1024, help="Read size in bytes")
    parser.add_argument("--progress-seconds", type=float, default=5.0, help="Progress log interval")
    return parser.parse_args()


def format_bytes(value: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.2f}{unit}"
        size /= 1024
    return f"{value}B"


def main() -> int:
    args = parse_args()
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temp_output = output.with_suffix(output.suffix + ".downloading")
    temp_output.unlink(missing_ok=True)

    req = urllib.request.Request(args.url, headers={"User-Agent": "Python-urllib/WorldPopDownloader"})
    started = time.time()
    last_log = started
    bytes_written = 0

    with urllib.request.urlopen(req, timeout=60) as response:
        total = int(response.headers.get("Content-Length") or 0)
        print(f"[INFO] status={getattr(response, 'status', 'unknown')} total={total}", flush=True)
        with temp_output.open("wb") as fh:
            while True:
                chunk = response.read(max(1024, int(args.chunk_size)))
                if not chunk:
                    break
                fh.write(chunk)
                bytes_written += len(chunk)
                now = time.time()
                if now - last_log >= args.progress_seconds:
                    speed = bytes_written / max(now - started, 1e-6)
                    if total > 0:
                        pct = (bytes_written / total) * 100.0
                        print(
                            f"[PROGRESS] {bytes_written}/{total} bytes ({pct:.2f}%) "
                            f"speed={format_bytes(int(speed))}/s",
                            flush=True,
                        )
                    else:
                        print(
                            f"[PROGRESS] {bytes_written} bytes speed={format_bytes(int(speed))}/s",
                            flush=True,
                        )
                    last_log = now

    os.replace(temp_output, output)
    elapsed = max(time.time() - started, 1e-6)
    print(
        f"[DONE] wrote={bytes_written} elapsed={elapsed:.1f}s avg_speed={format_bytes(int(bytes_written / elapsed))}/s "
        f"path={output}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
