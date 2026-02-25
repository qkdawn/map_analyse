#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import division

import argparse
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time
import traceback
import uuid


def _write_json(path, payload):
    folder = os.path.dirname(path)
    if folder and not os.path.exists(folder):
        os.makedirs(folder)
    text = json.dumps(payload, ensure_ascii=False)
    with io.open(path, "w", encoding="utf-8") as fh:
        if sys.version_info[0] < 3:
            if isinstance(text, unicode):
                out = text
            else:
                out = text.decode("utf-8", "replace")
            fh.write(out)
        else:
            fh.write(text)


def _read_json(path):
    with io.open(path, "r", encoding="utf-8") as fh:
        raw = fh.read()
    return json.loads(raw)


def _norm(name):
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _pick_field(feature_class, candidates):
    fields = [f.name for f in arcpy.ListFields(feature_class)]
    if not fields:
        return None
    normalized = {_norm(name): name for name in fields}
    for candidate in candidates:
        hit = normalized.get(_norm(candidate))
        if hit:
            return hit
    for candidate in candidates:
        c = _norm(candidate)
        for name in fields:
            n = _norm(name)
            if c in n or n in c:
                return name
    return None


def _safe_float(value):
    try:
        if value is None:
            return None
        f = float(value)
        if f != f:
            return None
        return f
    except Exception:
        return None


def _delete_if_exists(path):
    try:
        if path and arcpy.Exists(path):
            arcpy.Delete_management(path)
    except Exception:
        pass


def _tool_candidates(primary_name, legacy_name):
    items = []
    stats_mod = getattr(arcpy, "stats", None)
    if stats_mod is not None and hasattr(stats_mod, primary_name):
        items.append(getattr(stats_mod, primary_name))
    if hasattr(arcpy, legacy_name):
        items.append(getattr(arcpy, legacy_name))
    return items


def _run_tool(tools, param_sets, label):
    errors = []
    for tool in tools:
        for params in param_sets:
            try:
                out_target = params[2] if len(params) > 2 else None
                if out_target and arcpy.Exists(out_target):
                    arcpy.Delete_management(out_target)
                result = tool(*params)
                return result
            except Exception as exc:
                errors.append("%s(%d params): %s" % (label, len(params), str(exc)))
    raise RuntimeError("; ".join(errors[-6:]) if errors else (label + " failed"))


def _parse_global_moran_result(result_obj):
    values = []
    try:
        for idx in range(10):
            try:
                values.append(result_obj.getOutput(idx))
            except Exception:
                break
    except Exception:
        pass

    numbers = []
    for item in values:
        fv = _safe_float(item)
        if fv is not None:
            numbers.append(fv)
    if len(numbers) >= 3:
        return {
            "i": numbers[0],
            "z_score": numbers[1],
        }

    msg = arcpy.GetMessages()
    if msg:
        def _extract(pattern):
            m = re.search(pattern, msg, flags=re.IGNORECASE)
            if not m:
                return None
            return _safe_float(m.group(1))

        i_val = _extract(r"Moran[^\d-]*([-+]?\d+(?:\.\d+)?)")
        z_val = _extract(r"z[- ]?score[^\d-]*([-+]?\d+(?:\.\d+)?)")
        if i_val is not None or z_val is not None:
            return {
                "i": i_val,
                "z_score": z_val,
            }
    return {
        "i": None,
        "z_score": None,
    }


def _build_feature_class(rows):
    sr = arcpy.SpatialReference(4326)

    def _populate_rows(fc_path):
        source_id_to_h3 = {}
        next_source_id = 1
        with arcpy.da.InsertCursor(fc_path, ["SHAPE@", "H3_ID", "VALUE"]) as cursor:
            for row in rows:
                h3_id = (row or {}).get("h3_id")
                ring = (row or {}).get("ring") or []
                if not h3_id or len(ring) < 3:
                    continue
                pts = []
                for item in ring:
                    if not isinstance(item, (list, tuple)) or len(item) < 2:
                        continue
                    x = _safe_float(item[0])
                    y = _safe_float(item[1])
                    if x is None or y is None:
                        continue
                    pts.append(arcpy.Point(x, y))
                if len(pts) < 3:
                    continue
                if pts[0].X != pts[-1].X or pts[0].Y != pts[-1].Y:
                    pts.append(arcpy.Point(pts[0].X, pts[0].Y))
                polygon = arcpy.Polygon(arcpy.Array(pts), sr)
                cursor.insertRow([polygon, str(h3_id), float((_safe_float(row.get("value")) or 0.0))])
                source_id_to_h3[str(next_source_id)] = str(h3_id)
                next_source_id += 1
        return source_id_to_h3

    # Fast path: use in-memory workspace to reduce disk I/O.
    in_memory_name = "h3_cells_%s" % uuid.uuid4().hex[:8]
    in_memory_fc = os.path.join("in_memory", in_memory_name)
    try:
        _delete_if_exists(in_memory_fc)
        fc_path = arcpy.CreateFeatureclass_management(
            "in_memory",
            in_memory_name,
            "POLYGON",
            "",
            "DISABLED",
            "DISABLED",
            sr,
        ).getOutput(0)
        arcpy.AddField_management(fc_path, "H3_ID", "TEXT", field_length=32)
        arcpy.AddField_management(fc_path, "VALUE", "DOUBLE")
        source_id_to_h3 = _populate_rows(fc_path)
        return None, fc_path, source_id_to_h3, "in_memory"
    except Exception:
        _delete_if_exists(in_memory_fc)

    # Fallback: file geodatabase.
    tmp_dir = tempfile.mkdtemp(prefix="arcgis_h3_")
    gdb_name = "h3_%s.gdb" % uuid.uuid4().hex[:8]
    gdb_path = arcpy.CreateFileGDB_management(tmp_dir, gdb_name).getOutput(0)
    fc_path = arcpy.CreateFeatureclass_management(
        gdb_path,
        "h3_cells",
        "POLYGON",
        "",
        "DISABLED",
        "DISABLED",
        sr,
    ).getOutput(0)
    arcpy.AddField_management(fc_path, "H3_ID", "TEXT", field_length=32)
    arcpy.AddField_management(fc_path, "VALUE", "DOUBLE")
    source_id_to_h3 = _populate_rows(fc_path)
    return tmp_dir, fc_path, source_id_to_h3, "file_gdb"


def _collect_hotspot_rows(fc, source_id_to_h3=None):
    h3_field = _pick_field(fc, ["H3_ID", "SOURCE_ID", "Source_ID", "source_id"])
    gi_z_field = _pick_field(fc, ["GiZScore", "GI_ZSCORE", "ZScore"])

    out = {}
    fields = [f for f in [h3_field, gi_z_field] if f]
    if not h3_field or not fields:
        return out

    with arcpy.da.SearchCursor(fc, fields) as cursor:
        for row in cursor:
            data = dict(zip(fields, row))
            h3_id = str(data.get(h3_field) or "")
            if not h3_id:
                continue
            if source_id_to_h3 and h3_id in source_id_to_h3:
                h3_id = source_id_to_h3[h3_id]
            out[h3_id] = {
                "gi_z_score": _safe_float(data.get(gi_z_field)) if gi_z_field else None,
            }
    return out


def _collect_lisa_rows(fc, source_id_to_h3=None):
    h3_field = _pick_field(fc, ["H3_ID", "SOURCE_ID", "Source_ID", "source_id"])
    # LMiIndex is the primary ArcGIS native output for continuous LISA rendering.
    lisa_i_field = _pick_field(fc, ["LMiIndex", "LMI_INDEX", "LMI"])
    lisa_z_field = _pick_field(fc, ["LMiZScore", "LMI_ZSCORE", "ZScore"])

    out = {}
    fields = [f for f in [h3_field, lisa_i_field, lisa_z_field] if f]
    if not h3_field or not fields:
        return out

    with arcpy.da.SearchCursor(fc, fields) as cursor:
        for row in cursor:
            data = dict(zip(fields, row))
            h3_id = str(data.get(h3_field) or "")
            if not h3_id:
                continue
            if source_id_to_h3 and h3_id in source_id_to_h3:
                h3_id = source_id_to_h3[h3_id]
            out[h3_id] = {
                "lisa_i": _safe_float(data.get(lisa_i_field)) if lisa_i_field else None,
                "lisa_z_score": _safe_float(data.get(lisa_z_field)) if lisa_z_field else None,
            }
    return out


def run_pipeline(input_path, output_path, knn_neighbors):
    payload = _read_json(input_path)
    rows = payload.get("rows") or []

    if not rows:
        _write_json(output_path, {
            "ok": True,
            "status": "no_rows",
            "global_moran": {"i": None, "z_score": None},
            "cells": [],
        })
        return 0

    tmp_dir = None
    in_fc = None
    hot_fc = None
    lisa_fc = None
    timings = {}
    started_ts = time.time()
    try:
        t0 = time.time()
        tmp_dir, in_fc, source_id_to_h3, workspace_kind = _build_feature_class(rows)
        timings["build_fc_sec"] = round(time.time() - t0, 3)
        if str(workspace_kind) == "in_memory":
            unique = uuid.uuid4().hex[:8]
            hot_fc = os.path.join("in_memory", "hotspots_%s" % unique)
            lisa_fc = os.path.join("in_memory", "lisa_%s" % unique)
        else:
            workspace = os.path.dirname(in_fc)
            hot_fc = os.path.join(workspace, "hotspots")
            lisa_fc = os.path.join(workspace, "lisa")

        hot_tools = _tool_candidates("HotSpots", "HotSpots_stats")
        t1 = time.time()
        _run_tool(
            hot_tools,
            [
                [in_fc, "VALUE", hot_fc, "K_NEAREST_NEIGHBORS", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "#", "NO_FDR", int(knn_neighbors)],
                [in_fc, "VALUE", hot_fc, "FIXED_DISTANCE_BAND", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "#", "NO_FDR", "#"],
                [in_fc, "VALUE", hot_fc],
            ],
            "HotSpots",
        )
        timings["hotspots_sec"] = round(time.time() - t1, 3)

        lisa_tools = []
        stats_mod = getattr(arcpy, "stats", None)
        for name in ("ClusterOutlierAnalysis", "ClustersOutliers"):
            if stats_mod is not None and hasattr(stats_mod, name):
                lisa_tools.append(getattr(stats_mod, name))
        for name in ("ClusterOutlierAnalysis_stats", "ClustersOutliers_stats"):
            if hasattr(arcpy, name):
                lisa_tools.append(getattr(arcpy, name))
        t2 = time.time()
        _run_tool(
            lisa_tools,
            [
                [in_fc, "VALUE", lisa_fc, "K_NEAREST_NEIGHBORS", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "#", "NO_FDR", "#", int(knn_neighbors)],
                [in_fc, "VALUE", lisa_fc, "K_NEAREST_NEIGHBORS", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "#", "NO_FDR", "#"],
                [in_fc, "VALUE", lisa_fc, "K_NEAREST_NEIGHBORS", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "NO_FDR"],
                [in_fc, "VALUE", lisa_fc, "K_NEAREST_NEIGHBORS", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "#", "NO_FDR"],
                [in_fc, "VALUE", lisa_fc, "FIXED_DISTANCE_BAND", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "NO_FDR"],
                [in_fc, "VALUE", lisa_fc],
            ],
            "ClusterOutlierAnalysis",
        )
        timings["lisa_sec"] = round(time.time() - t2, 3)

        global_moran = {"i": None, "z_score": None}
        moran_tools = _tool_candidates("SpatialAutocorrelation", "SpatialAutocorrelation_stats")
        if moran_tools:
            try:
                t3 = time.time()
                moran_result = _run_tool(
                    moran_tools,
                    [
                        [in_fc, "VALUE", "NO_REPORT", "K_NEAREST_NEIGHBORS", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "#", int(knn_neighbors)],
                        [in_fc, "VALUE", "NO_REPORT", "FIXED_DISTANCE_BAND", "EUCLIDEAN_DISTANCE", "NONE", "#", "#", "#", "#"],
                        [in_fc, "VALUE"],
                    ],
                    "SpatialAutocorrelation",
                )
                global_moran = _parse_global_moran_result(moran_result)
                timings["global_moran_sec"] = round(time.time() - t3, 3)
            except Exception:
                global_moran = {"i": None, "z_score": None}
                timings["global_moran_sec"] = None

        t4 = time.time()
        hot_map = _collect_hotspot_rows(hot_fc, source_id_to_h3=source_id_to_h3)
        lisa_map = _collect_lisa_rows(lisa_fc, source_id_to_h3=source_id_to_h3)
        timings["collect_sec"] = round(time.time() - t4, 3)

        t5 = time.time()
        cells = []
        for row in rows:
            h3_id = str((row or {}).get("h3_id") or "")
            if not h3_id:
                continue
            hot = hot_map.get(h3_id) or {}
            lisa = lisa_map.get(h3_id) or {}
            cells.append({
                "h3_id": h3_id,
                "gi_z_score": hot.get("gi_z_score"),
                "lisa_i": lisa.get("lisa_i"),
                "lisa_z_score": lisa.get("lisa_z_score"),
            })
        timings["assemble_sec"] = round(time.time() - t5, 3)
        timings["total_sec"] = round(time.time() - started_ts, 3)

        _write_json(output_path, {
            "ok": True,
            "status": "ok",
            "global_moran": global_moran,
            "cells": cells,
            "timings": timings,
        })
        return 0
    except Exception as exc:
        _write_json(output_path, {
            "ok": False,
            "status": "error",
            "error": str(exc),
            "traceback": traceback.format_exc(),
        })
        return 1
    finally:
        _delete_if_exists(hot_fc)
        _delete_if_exists(lisa_fc)
        _delete_if_exists(in_fc)
        if tmp_dir and os.path.exists(tmp_dir):
            try:
                shutil.rmtree(tmp_dir)
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description="Run ArcGIS hotspot/LISA/moran for H3 cells")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--knn", type=int, default=8)
    # Backward compatibility: old bridge runner may still pass --fdr.
    parser.add_argument("--fdr", type=int, default=None)
    args = parser.parse_args()

    try:
        global arcpy
        import arcpy  # noqa: F401
    except Exception as exc:
        _write_json(args.output, {
            "ok": False,
            "status": "error",
            "error": "import arcpy failed: %s" % str(exc),
        })
        return 1

    arcpy.env.overwriteOutput = True
    return run_pipeline(
        input_path=args.input,
        output_path=args.output,
        knn_neighbors=max(1, int(args.knn or 8)),
    )


if __name__ == "__main__":
    sys.exit(main())
