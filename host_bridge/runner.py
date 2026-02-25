import json
import os
import shutil
import subprocess
import tempfile
import time
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .schemas import (
    ArcGISH3AnalyzeRequest,
    ArcGISH3ExportRequest,
    ArcGISRoadSyntaxWebGLRequest,
)


class ArcGISRunnerError(RuntimeError):
    pass


class ArcGISRunnerTimeout(TimeoutError):
    pass


def _is_windows_style_path(path: str) -> bool:
    if not path:
        return False
    return len(path) >= 3 and path[1:3] == ":\\" and path[0].isalpha()


def _wslpath_convert(flag: str, path: str) -> str:
    proc = subprocess.run(
        ["wslpath", flag, path],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        check=False,
    )
    if proc.returncode != 0:
        raise ArcGISRunnerError(proc.stderr.strip() or "wslpath conversion failed")
    out = str(proc.stdout or "").strip()
    if not out:
        raise ArcGISRunnerError("wslpath conversion returned empty path")
    return out


def _path_exists_cross_platform(path: str) -> bool:
    if not path:
        return False
    if Path(path).exists():
        return True
    if os.name != "nt" and _is_windows_style_path(path):
        try:
            linux_path = _wslpath_convert("-u", path)
            return Path(linux_path).exists()
        except Exception:
            return False
    return False


def _needs_windows_path_args(python_path: str) -> bool:
    if os.name == "nt":
        return False
    p = str(python_path or "").lower()
    return p.endswith("python.exe")


def _to_subprocess_path(path: str, use_windows_path_args: bool) -> str:
    if not use_windows_path_args:
        return path
    if _is_windows_style_path(path):
        return path
    # WSL -> Windows path conversion for python.exe subprocess.
    return _wslpath_convert("-w", path)


def _to_executable_path(path: str) -> str:
    if os.name == "nt":
        return path
    if _is_windows_style_path(path):
        # On WSL, subprocess executable must be a Linux path.
        return _wslpath_convert("-u", path)
    return path


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        f = float(value)
        if f != f:
            return None
        return f
    except Exception:
        return None


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _mix_hex_color(from_hex: str, to_hex: str, ratio: float) -> str:
    r = _clamp(float(ratio), 0.0, 1.0)
    f = str(from_hex or "#000000").lstrip("#")
    t = str(to_hex or "#000000").lstrip("#")
    if len(f) != 6 or len(t) != 6:
        return from_hex or "#000000"
    try:
        fr, fg, fb = int(f[0:2], 16), int(f[2:4], 16), int(f[4:6], 16)
        tr, tg, tb = int(t[0:2], 16), int(t[2:4], 16), int(t[4:6], 16)
    except Exception:
        return from_hex or "#000000"
    rr = round(fr + (tr - fr) * r)
    rg = round(fg + (tg - fg) * r)
    rb = round(fb + (tb - fb) * r)
    return f"#{rr:02x}{rg:02x}{rb:02x}"


def _resolve_gi_z_style(z_value: Optional[float]) -> Dict[str, Any]:
    z = _safe_float(z_value)
    if z is None:
        return {"fill": "#000000", "fill_opacity": 0.0}
    min_v, max_v, center = -3.0, 3.0, 0.0
    vv = _clamp(z, min_v, max_v)
    min_opacity, max_opacity = 0.10, 0.52
    threshold = 0.2
    if vv >= center:
        span = max(1e-9, max_v - center)
        ratio = (vv - center) / span
        fill = _mix_hex_color("#f8fafc", "#b91c1c", ratio)
    else:
        span = max(1e-9, center - min_v)
        ratio = (center - vv) / span
        fill = _mix_hex_color("#f8fafc", "#1d4ed8", ratio)
    if abs(vv - center) < threshold:
        return {"fill": fill, "fill_opacity": min_opacity * 0.6}
    fill_opacity = min_opacity + (max_opacity - min_opacity) * _clamp(ratio, 0.0, 1.0)
    return {"fill": fill, "fill_opacity": fill_opacity}


def _render_preview_svg(rows: List[Dict[str, Any]], cells_map: Dict[str, Dict[str, Any]]) -> str:
    all_pts: List[List[float]] = []
    valid_rows: List[Dict[str, Any]] = []

    for row in rows:
        h3_id = str((row or {}).get("h3_id") or "")
        ring = (row or {}).get("ring") or []
        if not h3_id or len(ring) < 3:
            continue
        clean_ring: List[List[float]] = []
        for pt in ring:
            if not isinstance(pt, (list, tuple)) or len(pt) < 2:
                continue
            x = _safe_float(pt[0])
            y = _safe_float(pt[1])
            if x is None or y is None:
                continue
            clean_ring.append([x, y])
        if len(clean_ring) < 3:
            continue
        all_pts.extend(clean_ring)
        valid_rows.append({"h3_id": h3_id, "ring": clean_ring})

    if not valid_rows or not all_pts:
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="240">'
            '<text x="16" y="36" font-size="16" fill="#374151">ArcGIS structure preview is empty</text>'
            '</svg>'
        )

    width = 920
    height = 920
    xs = [pt[0] for pt in all_pts]
    ys = [pt[1] for pt in all_pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    span_x = max(1e-9, max_x - min_x)
    span_y = max(1e-9, max_y - min_y)
    pad = 22.0
    draw_w = width - 2 * pad
    draw_h = height - 2 * pad

    def to_svg_xy(lng: float, lat: float) -> List[float]:
        x = pad + ((lng - min_x) / span_x) * draw_w
        y = pad + ((max_y - lat) / span_y) * draw_h
        return [x, y]

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect x="0" y="0" width="100%" height="100%" fill="#f8fafc"/>',
    ]
    for row in valid_rows:
        meta = cells_map.get(row["h3_id"]) or {}
        style = _resolve_gi_z_style(_safe_float(meta.get("gi_z_score")))
        fill = style["fill"]
        fill_opacity = float(style["fill_opacity"])
        stroke = "#2c6ecb"
        pts = [to_svg_xy(pt[0], pt[1]) for pt in row["ring"]]
        path_d = "M " + " L ".join(f"{p[0]:.2f} {p[1]:.2f}" for p in pts) + " Z"
        lines.append(
            f'<path d="{path_d}" fill="{fill}" fill-opacity="{fill_opacity:.3f}" '
            f'stroke="{stroke}" stroke-width="1.2" stroke-opacity="0.95"/>'
        )

    lines.extend(
        [
            '<rect x="16" y="16" width="246" height="92" rx="8" fill="#ffffff" fill-opacity="0.88" stroke="#d1d5db"/>',
            '<text x="28" y="38" font-size="12" fill="#111827">ArcGIS bridge preview</text>',
            '<text x="28" y="58" font-size="11" fill="#374151">Fill: GiZScore (continuous)</text>',
            '<text x="28" y="76" font-size="11" fill="#374151">Stroke: unified grid border (#2c6ecb)</text>',
            f'<text x="28" y="94" font-size="10" fill="#6b7280">Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</text>',
        ]
    )
    lines.append("</svg>")
    return "\n".join(lines)


class ArcGISRunner:
    def __init__(
        self,
        default_python_path: str,
        script_path: str,
        export_script_path: str = "",
        road_syntax_script_path: str = "",
    ):
        self.default_python_path = str(default_python_path or "").strip()
        self.script_path = str(script_path or "").strip()
        self.export_script_path = str(export_script_path or "").strip()
        self.road_syntax_script_path = str(road_syntax_script_path or "").strip()
        self.analyze_cache_ttl_sec = max(0, int(os.getenv("ARCGIS_ANALYZE_CACHE_TTL_SEC", "900") or 900))
        self.analyze_cache_max_entries = max(4, int(os.getenv("ARCGIS_ANALYZE_CACHE_MAX_ENTRIES", "32") or 32))
        self._analyze_cache: Dict[str, Dict[str, Any]] = {}

    def _resolve_python_path(self, override_path: Optional[str] = None) -> str:
        python_path = str(override_path or self.default_python_path or "").strip()
        if not python_path:
            raise ArcGISRunnerError("ARCGIS_PYTHON_PATH is empty")
        if not _path_exists_cross_platform(python_path):
            raise ArcGISRunnerError(f"ArcGIS python not found: {python_path}")
        return python_path

    def _resolve_script_path(self) -> str:
        script_path = str(self.script_path or "").strip()
        if not script_path:
            raise ArcGISRunnerError("ARCGIS_SCRIPT_PATH is empty")
        if not _path_exists_cross_platform(script_path):
            raise ArcGISRunnerError(f"ArcGIS script not found: {script_path}")
        return script_path

    def _resolve_export_script_path(self) -> str:
        script_path = str(self.export_script_path or "").strip()
        if not script_path:
            raise ArcGISRunnerError("ARCGIS_EXPORT_SCRIPT_PATH is empty")
        if not _path_exists_cross_platform(script_path):
            raise ArcGISRunnerError(f"ArcGIS export script not found: {script_path}")
        return script_path

    def _resolve_road_syntax_script_path(self) -> str:
        script_path = str(self.road_syntax_script_path or "").strip()
        if not script_path:
            raise ArcGISRunnerError("ARCGIS_ROAD_SYNTAX_SCRIPT_PATH is empty")
        if not _path_exists_cross_platform(script_path):
            raise ArcGISRunnerError(f"ArcGIS road-syntax script not found: {script_path}")
        return script_path

    def _run_subprocess(self, cmd: List[str], timeout_sec: int) -> subprocess.CompletedProcess:
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="ignore",
                timeout=int(timeout_sec),
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise ArcGISRunnerTimeout(f"ArcGIS subprocess timeout after {timeout_sec}s") from exc

        if proc.returncode != 0:
            err_msg = proc.stderr.strip() or proc.stdout.strip() or "unknown subprocess error"
            raise ArcGISRunnerError(f"ArcGIS subprocess failed({proc.returncode}): {err_msg}")
        return proc

    def _build_analyze_cache_key(
        self,
        rows: List[Dict[str, Any]],
        knn_neighbors: int,
        python_path: str,
        script_path: str,
    ) -> str:
        script_mtime = 0
        try:
            script_mtime = int(Path(script_path).stat().st_mtime)
        except Exception:
            script_mtime = 0
        payload = {
            "rows": rows,
            "knn_neighbors": int(knn_neighbors),
            "python_path": str(python_path or ""),
            "script_path": str(script_path or ""),
            "script_mtime": script_mtime,
        }
        raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _gc_analyze_cache(self, now_ts: float) -> None:
        if not self._analyze_cache:
            return
        if self.analyze_cache_ttl_sec > 0:
            expire_before = now_ts - float(self.analyze_cache_ttl_sec)
            drop_keys = [
                key for key, entry in self._analyze_cache.items()
                if float(entry.get("created_ts", 0.0)) < expire_before
            ]
            for key in drop_keys:
                self._analyze_cache.pop(key, None)
        if len(self._analyze_cache) <= self.analyze_cache_max_entries:
            return
        ordered = sorted(
            self._analyze_cache.items(),
            key=lambda item: float((item[1] or {}).get("created_ts", 0.0)),
        )
        for key, _entry in ordered[: max(0, len(ordered) - self.analyze_cache_max_entries)]:
            self._analyze_cache.pop(key, None)

    def _get_cached_analyze(self, cache_key: str, now_ts: float) -> Optional[Dict[str, Any]]:
        self._gc_analyze_cache(now_ts)
        entry = self._analyze_cache.get(cache_key)
        if not entry:
            return None
        # Return a detached copy to avoid accidental mutation.
        return {
            "status": str(entry.get("status") or "ok"),
            "cells": list(entry.get("cells") or []),
            "global_moran": dict(entry.get("global_moran") or {}),
            "stderr": str(entry.get("stderr") or ""),
            "stdout": str(entry.get("stdout") or ""),
            "timings": dict(entry.get("timings") or {}),
            "cache_hit": True,
        }

    def _put_cached_analyze(self, cache_key: str, payload: Dict[str, Any], now_ts: float) -> None:
        if self.analyze_cache_ttl_sec <= 0:
            return
        self._analyze_cache[cache_key] = {
            "created_ts": float(now_ts),
            "status": str(payload.get("status") or "ok"),
            "cells": list(payload.get("cells") or []),
            "global_moran": dict(payload.get("global_moran") or {}),
            "stderr": str(payload.get("stderr") or ""),
            "stdout": str(payload.get("stdout") or ""),
            "timings": dict(payload.get("timings") or {}),
        }
        self._gc_analyze_cache(now_ts)

    def run(self, req: ArcGISH3AnalyzeRequest, trace_id: str) -> Dict[str, Any]:
        rows = [row.model_dump() if hasattr(row, "model_dump") else row.dict() for row in req.rows]
        if not rows:
            return {
                "status": "no_rows",
                "cells": [],
                "global_moran": {"i": None, "z_score": None},
                "preview_svg": None,
                "stderr": "",
                "stdout": "",
            }

        python_path = self._resolve_python_path(req.arcgis_python_path)
        script_path = self._resolve_script_path()
        use_windows_path_args = _needs_windows_path_args(python_path)
        input_payload = {
            "rows": rows,
            "knn_neighbors": int(req.knn_neighbors),
        }
        now_ts = time.time()
        cache_key = self._build_analyze_cache_key(
            rows=rows,
            knn_neighbors=int(req.knn_neighbors),
            python_path=python_path,
            script_path=script_path,
        )
        cached = self._get_cached_analyze(cache_key, now_ts)
        if cached is not None:
            cells = cached.get("cells") or []
            cells_map: Dict[str, Dict[str, Any]] = {}
            for item in cells:
                h3_id = str((item or {}).get("h3_id") or "")
                if h3_id:
                    cells_map[h3_id] = item
            preview_svg = None
            if req.export_image:
                preview_svg = _render_preview_svg(rows, cells_map)
            return {
                "status": f"{cached.get('status') or 'ok'} [cache]",
                "cells": cells,
                "global_moran": cached.get("global_moran") or {},
                "preview_svg": preview_svg,
                "stderr": cached.get("stderr") or "",
                "stdout": cached.get("stdout") or "",
                "timings": cached.get("timings") or {},
                "cache_hit": True,
            }

        tmp_dir = tempfile.mkdtemp(prefix=f"arcgis_bridge_{trace_id}_")
        try:
            input_path = Path(tmp_dir) / "input.json"
            output_path = Path(tmp_dir) / "output.json"
            input_path.write_text(json.dumps(input_payload, ensure_ascii=False), encoding="utf-8")

            cmd = [
                _to_executable_path(python_path),
                _to_subprocess_path(script_path, use_windows_path_args),
                "--input",
                _to_subprocess_path(str(input_path), use_windows_path_args),
                "--output",
                _to_subprocess_path(str(output_path), use_windows_path_args),
                "--knn",
                str(int(req.knn_neighbors)),
            ]

            proc = self._run_subprocess(cmd, timeout_sec=int(req.timeout_sec))
            if not output_path.exists():
                raise ArcGISRunnerError("ArcGIS output file missing")

            output = json.loads(output_path.read_text(encoding="utf-8"))
            if not bool(output.get("ok")):
                raise ArcGISRunnerError(str(output.get("error") or "ArcGIS returned non-ok status"))

            cells = output.get("cells") or []
            global_moran = output.get("global_moran") or {}
            status = str(output.get("status") or "ok")
            timings = dict(output.get("timings") or {})
            total_sec = _safe_float(timings.get("total_sec"))
            if total_sec is not None:
                status = f"{status} ({total_sec:.2f}s)"
            cells_map: Dict[str, Dict[str, Any]] = {}
            for item in cells:
                h3_id = str((item or {}).get("h3_id") or "")
                if h3_id:
                    cells_map[h3_id] = item

            preview_svg = None
            if req.export_image:
                preview_svg = _render_preview_svg(rows, cells_map)

            result = {
                "status": status,
                "cells": cells,
                "global_moran": global_moran,
                "preview_svg": preview_svg,
                "stderr": proc.stderr.strip(),
                "stdout": proc.stdout.strip(),
                "timings": timings,
                "cache_hit": False,
            }
            self._put_cached_analyze(cache_key, result, now_ts=time.time())
            return result
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def run_export(self, req: ArcGISH3ExportRequest, trace_id: str) -> Dict[str, Any]:
        grid_features = list(req.grid_features or [])
        if not grid_features:
            raise ArcGISRunnerError("grid_features is empty")

        python_path = self._resolve_python_path(req.arcgis_python_path)
        script_path = self._resolve_export_script_path()
        use_windows_path_args = _needs_windows_path_args(python_path)

        normalized_format = "arcgis_package" if str(req.format) == "arcgis_package" else "gpkg"
        output_ext = ".zip" if normalized_format == "arcgis_package" else ".gpkg"
        output_name = f"h3_analysis_{trace_id}{output_ext}"

        payload = {
            "format": normalized_format,
            "include_poi": bool(req.include_poi),
            "style_mode": str(req.style_mode or "density"),
            "grid_features": grid_features,
            "poi_features": list(req.poi_features or []),
            "style_meta": dict(req.style_meta or {}),
        }

        tmp_dir = tempfile.mkdtemp(prefix=f"arcgis_export_{trace_id}_")
        try:
            input_path = Path(tmp_dir) / "input.json"
            output_path = Path(tmp_dir) / output_name
            input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

            cmd = [
                _to_executable_path(python_path),
                _to_subprocess_path(script_path, use_windows_path_args),
                "--input",
                _to_subprocess_path(str(input_path), use_windows_path_args),
                "--output",
                _to_subprocess_path(str(output_path), use_windows_path_args),
                "--format",
                normalized_format,
            ]
            if req.include_poi:
                cmd.extend(["--include-poi", "1"])
            else:
                cmd.extend(["--include-poi", "0"])

            proc = self._run_subprocess(cmd, timeout_sec=int(req.timeout_sec))
            if not output_path.exists():
                raise ArcGISRunnerError("ArcGIS export output file missing")

            content = output_path.read_bytes()
            if not content:
                raise ArcGISRunnerError("ArcGIS export output is empty")

            return {
                "status": "ok",
                "filename": output_name,
                "content_type": "application/zip" if normalized_format == "arcgis_package" else "application/geopackage+sqlite3",
                "content": content,
                "stderr": proc.stderr.strip(),
                "stdout": proc.stdout.strip(),
            }
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def run_road_syntax_webgl(self, req: ArcGISRoadSyntaxWebGLRequest, trace_id: str) -> Dict[str, Any]:
        roads_features = list(req.roads_features or [])
        if not roads_features:
            raise ArcGISRunnerError("roads_features is empty")

        python_path = self._resolve_python_path(req.arcgis_python_path)
        script_path = self._resolve_road_syntax_script_path()
        use_windows_path_args = _needs_windows_path_args(python_path)

        payload = {
            "roads_features": roads_features,
            "metric_field": str(req.metric_field or "accessibility_score"),
            "target_coord_type": str(req.target_coord_type or "gcj02"),
        }

        tmp_dir = tempfile.mkdtemp(prefix=f"arcgis_road_syntax_{trace_id}_")
        started_at = time.perf_counter()
        try:
            input_path = Path(tmp_dir) / "input.json"
            output_path = Path(tmp_dir) / "output.json"
            input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

            cmd = [
                _to_executable_path(python_path),
                _to_subprocess_path(script_path, use_windows_path_args),
                "--input",
                _to_subprocess_path(str(input_path), use_windows_path_args),
                "--output",
                _to_subprocess_path(str(output_path), use_windows_path_args),
            ]

            proc = self._run_subprocess(cmd, timeout_sec=int(req.timeout_sec))
            if not output_path.exists():
                raise ArcGISRunnerError("ArcGIS road-syntax output file missing")

            output = json.loads(output_path.read_text(encoding="utf-8"))
            if not bool(output.get("ok")):
                raise ArcGISRunnerError(str(output.get("error") or "ArcGIS returned non-ok status"))

            roads = output.get("roads") if isinstance(output.get("roads"), dict) else {}
            features = roads.get("features") if isinstance(roads.get("features"), list) else []
            normalized_roads = {
                "type": "FeatureCollection",
                "features": features,
                "count": int(roads.get("count")) if isinstance(roads.get("count"), int) else len(features),
            }
            elapsed_ms = _safe_float(output.get("elapsed_ms"))
            if elapsed_ms is None:
                elapsed_ms = (time.perf_counter() - started_at) * 1000.0

            return {
                "status": str(output.get("status") or "ok"),
                "metric_field": str(output.get("metric_field") or payload["metric_field"]),
                "coord_type": str(output.get("coord_type") or payload["target_coord_type"]),
                "roads": normalized_roads,
                "elapsed_ms": round(float(elapsed_ms), 2),
                "stderr": proc.stderr.strip(),
                "stdout": proc.stdout.strip(),
            }
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
