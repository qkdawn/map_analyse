#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import division

import argparse
import io
import json
import math
import os
import re
import shutil
import sys
import tempfile
import time
import traceback
import uuid


_now = getattr(time, "perf_counter", time.time)


def _write_json(path, payload):
    folder = os.path.dirname(path)
    if folder and not os.path.exists(folder):
        os.makedirs(folder)
    text = json.dumps(payload, ensure_ascii=False)
    with io.open(path, "w", encoding="utf-8") as fh:
        if sys.version_info[0] < 3:
            if isinstance(text, unicode):
                fh.write(text)
            else:
                fh.write(text.decode("utf-8", "replace"))
        else:
            fh.write(text)


def _read_json(path):
    with io.open(path, "r", encoding="utf-8") as fh:
        return json.loads(fh.read())


def _is_finite_number(value):
    try:
        if hasattr(math, "isfinite"):
            return bool(math.isfinite(value))
        return not (math.isinf(value) or math.isnan(value))
    except Exception:
        return False


def _safe_float(value, fallback=None):
    try:
        if value is None:
            return fallback
        parsed = float(value)
        if not _is_finite_number(parsed):
            return fallback
        return parsed
    except Exception:
        return fallback


def _norm(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _pick_field(feature_class, candidates):
    fields = [field.name for field in arcpy.ListFields(feature_class)]
    if not fields:
        return None
    normalized = {_norm(name): name for name in fields}
    for candidate in candidates:
        hit = normalized.get(_norm(candidate))
        if hit:
            return hit
    for candidate in candidates:
        cn = _norm(candidate)
        for name in fields:
            fn = _norm(name)
            if cn and (cn in fn or fn in cn):
                return name
    return None


def _field_name(raw, fallback):
    safe = re.sub(r"[^A-Za-z0-9_]", "_", str(raw or "").strip()).strip("_") or fallback
    if safe[0].isdigit():
        safe = "F_" + safe
    return safe[:48]


def _delete_if_exists(path):
    try:
        if path and arcpy.Exists(path):
            arcpy.Delete_management(path)
    except Exception:
        pass


def _get_predictor_keys(payload, rows):
    keys = []
    for item in payload.get("variables") or []:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        if key and key not in keys:
            keys.append(key)
    if not keys and rows:
        predictors = rows[0].get("predictors") if isinstance(rows[0].get("predictors"), dict) else {}
        keys = [str(key) for key in predictors.keys()]
    return keys


def _collect_valid_rows(rows, dependent_variable, predictor_keys):
    valid = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        cell_id = str(row.get("cell_id") or "").strip()
        predictors = row.get("predictors") if isinstance(row.get("predictors"), dict) else {}
        raw_centroid = row.get("centroid")
        if isinstance(raw_centroid, dict):
            centroid = raw_centroid
            lng = _safe_float(centroid.get("lng"), None)
            lat = _safe_float(centroid.get("lat"), None)
        elif isinstance(raw_centroid, (list, tuple)) and len(raw_centroid) >= 2:
            lng = _safe_float(raw_centroid[0], None)
            lat = _safe_float(raw_centroid[1], None)
        else:
            lng = None
            lat = None
        observed = _safe_float(row.get(dependent_variable), None)
        if not cell_id or observed is None or lng is None or lat is None:
            continue
        x_values = {}
        has_any_x = False
        for key in predictor_keys:
            value = _safe_float(predictors.get(key), 0.0)
            if value is None:
                value = 0.0
            if abs(value) > 1e-12:
                has_any_x = True
            x_values[key] = float(value)
        if not has_any_x:
            continue
        valid.append(
            {
                "cell_id": cell_id,
                "observed": float(observed),
                "lng": float(lng),
                "lat": float(lat),
                "predictors": x_values,
            }
        )
    return valid


def _create_input_feature_class(gdb_path, rows, dependent_field, predictor_field_map):
    sr = arcpy.SpatialReference(4326)
    fc = arcpy.CreateFeatureclass_management(
        gdb_path,
        "gwr_input",
        "POINT",
        "",
        "DISABLED",
        "DISABLED",
        sr,
    ).getOutput(0)
    arcpy.AddField_management(fc, "CELL_ID", "TEXT", field_length=128)
    arcpy.AddField_management(fc, "SRC_ID", "LONG")
    arcpy.AddField_management(fc, dependent_field, "DOUBLE")
    for field_name in predictor_field_map.values():
        arcpy.AddField_management(fc, field_name, "DOUBLE")

    source_by_id = {}
    fields = ["SHAPE@XY", "CELL_ID", "SRC_ID", dependent_field] + list(predictor_field_map.values())
    with arcpy.da.InsertCursor(fc, fields) as cursor:
        for idx, row in enumerate(rows, start=1):
            source_by_id[str(idx)] = row
            cursor.insertRow(
                [
                    (row["lng"], row["lat"]),
                    row["cell_id"],
                    idx,
                    row["observed"],
                ]
                + [row["predictors"].get(key, 0.0) for key in predictor_field_map.keys()]
            )
    return fc, source_by_id


def _run_gwr_tool(input_fc, output_fc, dependent_field, predictor_fields, neighbor_count):
    errors = []

    stats_mod = getattr(arcpy, "stats", None)
    if stats_mod is not None and hasattr(stats_mod, "GWR"):
        try:
            return stats_mod.GWR(
                input_fc,
                dependent_field,
                "CONTINUOUS",
                list(predictor_fields),
                output_fc,
                "NUMBER_OF_NEIGHBORS",
                "USER_DEFINED",
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                int(neighbor_count),
                None,
                None,
                None,
                None,
                "GAUSSIAN",
            )
        except Exception as exc:
            errors.append("arcpy.stats.GWR: %s" % str(exc))

    if hasattr(arcpy, "GeographicallyWeightedRegression_stats"):
        try:
            return arcpy.GeographicallyWeightedRegression_stats(
                input_fc,
                dependent_field,
                ";".join(predictor_fields),
                output_fc,
                "ADAPTIVE",
                "BANDWIDTH_PARAMETER",
                None,
                int(neighbor_count),
            )
        except Exception as exc:
            errors.append("GeographicallyWeightedRegression_stats: %s" % str(exc))

    raise RuntimeError("; ".join(errors[-4:]) if errors else "ArcGIS GWR tool is not available")


def _summarize(cells, predictor_keys):
    pairs = []
    for cell in cells:
        observed = _safe_float(cell.get("observed"), None)
        predicted = _safe_float(cell.get("predicted"), None)
        if observed is not None and predicted is not None:
            pairs.append((observed, predicted))
    if not pairs:
        r2 = None
        rmse = None
        mean_abs = None
    else:
        y_values = [item[0] for item in pairs]
        mean_y = sum(y_values) / float(len(y_values))
        sse = sum((obs - pred) ** 2 for obs, pred in pairs)
        sst = sum((obs - mean_y) ** 2 for obs in y_values)
        r2 = None if sst <= 0 else max(-1.0, min(1.0, 1.0 - sse / sst))
        rmse = math.sqrt(sse / float(len(pairs)))
        mean_abs = sum(abs(obs - pred) for obs, pred in pairs) / float(len(pairs))

    top_variables = []
    for key in predictor_keys:
        vals = []
        for cell in cells:
            coef = _safe_float((cell.get("coefficients") or {}).get(key), None)
            if coef is not None:
                vals.append(abs(coef))
        if vals:
            top_variables.append({"key": key, "score": round(sum(vals) / float(len(vals)), 6)})
    top_variables = sorted(top_variables, key=lambda item: item["score"], reverse=True)[:5]
    return {
        "status": "ArcGIS GWR 计算完成",
        "r2": round(r2, 6) if r2 is not None else None,
        "adjusted_r2": None,
        "mean_abs_residual": round(mean_abs, 6) if mean_abs is not None else None,
        "rmse": round(rmse, 6) if rmse is not None else None,
        "top_variables": top_variables,
    }


def _collect_cells(output_fc, source_by_id, predictor_keys, predictor_field_map):
    cell_field = _pick_field(output_fc, ["CELL_ID", "cell_id"])
    src_field = _pick_field(output_fc, ["SRC_ID", "src_id"])
    predicted_field = _pick_field(output_fc, ["PREDICTED", "PREDICTED_Y", "PREDICT"])
    residual_field = _pick_field(output_fc, ["RESIDUAL", "RESID", "STDRESID"])
    local_r2_field = _pick_field(output_fc, ["LOCALR2", "LOCAL_R2", "LOCAL R2"])
    coef_fields = {}
    for key in predictor_keys:
        src = predictor_field_map[key]
        coef_fields[key] = _pick_field(output_fc, [
            src,
            "C_%s" % src,
            "COEF_%s" % src,
            "%s_COEF" % src,
            "%s_COEFFICIENT" % src,
        ])

    wanted = ["OID@"]
    for field in [cell_field, src_field, predicted_field, residual_field, local_r2_field] + list(coef_fields.values()):
        if field and field not in wanted:
            wanted.append(field)

    index = dict((name, idx) for idx, name in enumerate(wanted))
    ordered_sources = [source_by_id[str(idx)] for idx in range(1, len(source_by_id) + 1) if str(idx) in source_by_id]
    cells = []
    try:
        cursor_obj = arcpy.da.SearchCursor(output_fc, wanted, sql_clause=(None, "ORDER BY OBJECTID"))
    except Exception:
        cursor_obj = arcpy.da.SearchCursor(output_fc, wanted)
    with cursor_obj as cursor:
        for row_idx, record in enumerate(cursor):
            src_id = None
            if src_field and src_field in index:
                src_id = str(record[index[src_field]] or "")
            source = source_by_id.get(src_id) if src_id else None
            cell_id = ""
            if cell_field and cell_field in index:
                cell_id = str(record[index[cell_field]] or "")
            if not source and cell_id:
                for candidate in source_by_id.values():
                    if candidate.get("cell_id") == cell_id:
                        source = candidate
                        break
            if not source:
                source = ordered_sources[row_idx] if row_idx < len(ordered_sources) else None
            if not source:
                continue
            predicted = _safe_float(record[index[predicted_field]], None) if predicted_field and predicted_field in index else None
            residual = _safe_float(record[index[residual_field]], None) if residual_field and residual_field in index else None
            if residual is None and predicted is not None:
                residual = source["observed"] - predicted
            coefficients = {}
            for key, field in coef_fields.items():
                if field and field in index:
                    coefficients[key] = _safe_float(record[index[field]], None)
            cells.append(
                {
                    "cell_id": str(source.get("cell_id") or cell_id),
                    "observed": source["observed"],
                    "predicted": predicted,
                    "residual": residual,
                    "local_r2": _safe_float(record[index[local_r2_field]], None) if local_r2_field and local_r2_field in index else None,
                    "coefficients": coefficients,
                    "predictors": source.get("predictors") or {},
                }
            )
    return cells


def analyze(payload):
    started = _now()
    rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
    dependent_variable = str(payload.get("dependent_variable") or "nightlight_radiance")
    predictor_keys = _get_predictor_keys(payload, rows)
    if not predictor_keys:
        raise RuntimeError("GWR explanatory variables are empty")
    valid_rows = _collect_valid_rows(rows, dependent_variable, predictor_keys)
    min_samples = max(12, len(predictor_keys) + 4)
    if len(valid_rows) < min_samples:
        raise RuntimeError("有效样本不足：%d/%d" % (len(valid_rows), min_samples))

    tmp_dir = tempfile.mkdtemp(prefix="arcgis_gwr_script_")
    try:
        gdb_path = arcpy.CreateFileGDB_management(tmp_dir, "gwr_%s.gdb" % uuid.uuid4().hex[:8]).getOutput(0)
        dependent_field = "NL_RAD"
        predictor_field_map = {}
        used_fields = set([dependent_field, "CELL_ID", "SRC_ID"])
        for idx, key in enumerate(predictor_keys, start=1):
            base = _field_name(key, "X%d" % idx)
            if len(base) > 24:
                base = "X%d_%s" % (idx, base[:18])
            candidate = base
            suffix = 1
            while candidate.upper() in used_fields:
                suffix += 1
                candidate = ("%s_%d" % (base[:20], suffix))[:48]
            used_fields.add(candidate.upper())
            predictor_field_map[key] = candidate

        input_fc, source_by_id = _create_input_feature_class(gdb_path, valid_rows, dependent_field, predictor_field_map)
        output_fc = os.path.join(gdb_path, "gwr_output")
        neighbor_count = min(max(8, len(predictor_keys) + 3), max(1, len(valid_rows) - 1))
        _delete_if_exists(output_fc)
        _run_gwr_tool(
            input_fc,
            output_fc,
            dependent_field,
            [predictor_field_map[key] for key in predictor_keys],
            neighbor_count,
        )
        cells = _collect_cells(output_fc, source_by_id, predictor_keys, predictor_field_map)
        if not cells:
            output_fields = [field.name for field in arcpy.ListFields(output_fc)]
            raise RuntimeError("ArcGIS GWR 没有返回有效格网结果；输出字段：%s" % ",".join(output_fields))
        elapsed_ms = round((_now() - started) * 1000.0, 2)
        return {
            "ok": True,
            "status": "ok",
            "summary": _summarize(cells, predictor_keys),
            "cells": cells,
            "diagnostics": {
                "engine": "arcgis",
                "sample_count": len(cells),
                "neighbor_count": neighbor_count,
                "elapsed_ms": elapsed_ms,
            },
        }
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    try:
        global arcpy
        import arcpy  # noqa

        payload = _read_json(args.input)
        result = analyze(payload)
        _write_json(args.output, result)
        return 0
    except Exception as exc:
        error = "%s\n%s" % (str(exc), traceback.format_exc())
        _write_json(args.output, {"ok": False, "status": "error", "error": error})
        return 2


if __name__ == "__main__":
    sys.exit(main())
