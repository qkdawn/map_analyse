#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import division

import argparse
import io
import json
import os
import shutil
import sys
import tempfile
import traceback
import zipfile


def _read_json(path):
    with io.open(path, "r", encoding="utf-8") as fh:
        return json.loads(fh.read())


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


def _safe_text(value):
    if value is None:
        return ""
    try:
        return unicode(value)  # noqa: F821  (py2)
    except Exception:
        return str(value)


def _normalize_point(pt):
    if isinstance(pt, (list, tuple)) and len(pt) >= 2:
        x = _safe_float(pt[0])
        y = _safe_float(pt[1])
        if x is not None and y is not None:
            return [x, y]
        return None
    if isinstance(pt, dict):
        x = _safe_float(pt.get("lng"))
        y = _safe_float(pt.get("lat"))
        if x is None or y is None:
            x = _safe_float(pt.get("lon"))
            y = _safe_float(pt.get("lat"))
        if x is not None and y is not None:
            return [x, y]
    return None


def _normalize_ring(raw_ring):
    clean_ring = []
    for pt in raw_ring or []:
        norm = _normalize_point(pt)
        if norm is not None:
            clean_ring.append(norm)
    if len(clean_ring) < 3:
        return []
    first = clean_ring[0]
    last = clean_ring[-1]
    if first[0] != last[0] or first[1] != last[1]:
        clean_ring.append([first[0], first[1]])
    if len(clean_ring) < 4:
        return []
    return clean_ring


def _iter_outer_rings(geom):
    if not isinstance(geom, dict):
        return
    g_type = str(geom.get("type") or "")
    coords = geom.get("coordinates") or []
    if g_type == "Polygon":
        if not coords:
            return
        # Standard GeoJSON Polygon: [ [ [x,y], ... ], hole... ]
        if isinstance(coords, (list, tuple)) and coords and isinstance(coords[0], (list, tuple)):
            # Some payloads may send direct ring: [ [x,y], ... ]
            if coords and coords[0] and isinstance(coords[0][0], (int, float)):
                yield coords
            else:
                ring = coords[0] if len(coords) > 0 else []
                yield ring
        return
    if g_type == "MultiPolygon":
        for poly in coords or []:
            if not isinstance(poly, (list, tuple)) or not poly:
                continue
            # Standard: [ [ [x,y], ... ], hole... ]
            if poly and isinstance(poly[0], (list, tuple)):
                if poly[0] and isinstance(poly[0][0], (int, float)):
                    yield poly
                else:
                    ring = poly[0] if len(poly) > 0 else []
                    yield ring
        return


def _extract_grid_rows(payload):
    rows = []
    for feature in (payload.get("grid_features") or []):
        if not isinstance(feature, dict):
            continue
        geom = feature.get("geometry") or {}
        props = feature.get("properties") or {}
        has_valid_ring = False
        for raw_ring in _iter_outer_rings(geom):
            clean_ring = _normalize_ring(raw_ring)
            if not clean_ring:
                continue
            has_valid_ring = True
            rows.append({
                "h3_id": _safe_text(props.get("h3_id") or props.get("id")),
                "ring": clean_ring,
                "density": _safe_float(props.get("density_poi_per_km2")),
                "gi_z": _safe_float(props.get("gi_star_z_score")),
                "lisa_i": _safe_float(props.get("lisa_i")),
            })
        if has_valid_ring:
            continue

        # Fallback: some clients may pass direct path in properties/path.
        fallback_ring = feature.get("path") or props.get("path") or []
        clean_ring = _normalize_ring(fallback_ring)
        if not clean_ring:
            continue
        rows.append({
            "h3_id": _safe_text(props.get("h3_id") or props.get("id")),
            "ring": clean_ring,
            "density": _safe_float(props.get("density_poi_per_km2")),
            "gi_z": _safe_float(props.get("gi_star_z_score")),
            "lisa_i": _safe_float(props.get("lisa_i")),
        })
    return rows


def _extract_poi_rows(payload):
    rows = []
    for feature in (payload.get("poi_features") or []):
        if not isinstance(feature, dict):
            continue
        geom = feature.get("geometry") or {}
        props = feature.get("properties") or {}
        lng = None
        lat = None
        if str(geom.get("type") or "") == "Point":
            coords = geom.get("coordinates") or []
            if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                lng = _safe_float(coords[0])
                lat = _safe_float(coords[1])
        if lng is None or lat is None:
            loc = props.get("location")
            if isinstance(loc, (list, tuple)) and len(loc) >= 2:
                lng = _safe_float(loc[0])
                lat = _safe_float(loc[1])
        if lng is None or lat is None:
            continue
        rows.append({
            "lng": lng,
            "lat": lat,
            "name": _safe_text(props.get("name") or props.get("poi_name") or ""),
            "type": _safe_text(props.get("type") or ""),
            "category": _safe_text(props.get("category") or props.get("category_id") or ""),
        })
    return rows


def _build_polygon(points, sr):
    arr = []
    for x, y in points:
        arr.append(arcpy.Point(x, y))
    if arr[0].X != arr[-1].X or arr[0].Y != arr[-1].Y:
        arr.append(arcpy.Point(arr[0].X, arr[0].Y))
    return arcpy.Polygon(arcpy.Array(arr), sr)


def _build_grid_fc(workspace, rows):
    sr = arcpy.SpatialReference(4326)
    fc = arcpy.CreateFeatureclass_management(
        workspace,
        "h3_grid",
        "POLYGON",
        "",
        "DISABLED",
        "DISABLED",
        sr,
    ).getOutput(0)
    arcpy.AddField_management(fc, "H3_ID", "TEXT", field_length=32)
    arcpy.AddField_management(fc, "DENSITY", "DOUBLE")
    arcpy.AddField_management(fc, "GI_Z", "DOUBLE")
    arcpy.AddField_management(fc, "LISA_I", "DOUBLE")

    with arcpy.da.InsertCursor(fc, ["SHAPE@", "H3_ID", "DENSITY", "GI_Z", "LISA_I"]) as cursor:
        for row in rows:
            if not row.get("ring"):
                continue
            poly = _build_polygon(row["ring"], sr)
            cursor.insertRow([
                poly,
                row.get("h3_id") or "",
                row.get("density"),
                row.get("gi_z"),
                row.get("lisa_i"),
            ])
    return fc


def _build_poi_fc(workspace, rows):
    if not rows:
        return None
    sr = arcpy.SpatialReference(4326)
    fc = arcpy.CreateFeatureclass_management(
        workspace,
        "poi_points",
        "POINT",
        "",
        "DISABLED",
        "DISABLED",
        sr,
    ).getOutput(0)
    arcpy.AddField_management(fc, "NAME", "TEXT", field_length=128)
    arcpy.AddField_management(fc, "TYPE", "TEXT", field_length=64)
    arcpy.AddField_management(fc, "CATEGORY", "TEXT", field_length=64)
    with arcpy.da.InsertCursor(fc, ["SHAPE@", "NAME", "TYPE", "CATEGORY"]) as cursor:
        for row in rows:
            cursor.insertRow([
                arcpy.PointGeometry(arcpy.Point(row["lng"], row["lat"]), sr),
                row.get("name") or "",
                row.get("type") or "",
                row.get("category") or "",
            ])
    return fc


def _export_gpkg(grid_fc, poi_fc, output_path, include_poi):
    out_dir = os.path.dirname(output_path)
    if not os.path.isdir(out_dir):
        os.makedirs(out_dir)
    if os.path.exists(output_path):
        os.remove(output_path)

    created = False
    # ArcMap versions have different signatures:
    # - CreateSQLiteDatabase_management(output_path, spatial_type)
    # - CreateSQLiteDatabase_management(folder, name, spatial_type)
    try:
        arcpy.CreateSQLiteDatabase_management(output_path, "GEOPACKAGE")
        created = True
    except TypeError:
        pass
    except Exception:
        pass
    if not created:
        out_name = os.path.basename(output_path)
        arcpy.CreateSQLiteDatabase_management(out_dir, out_name, "GEOPACKAGE")
    arcpy.FeatureClassToFeatureClass_conversion(grid_fc, output_path, "h3_grid")
    if include_poi and poi_fc and arcpy.Exists(poi_fc):
        arcpy.FeatureClassToFeatureClass_conversion(poi_fc, output_path, "poi_points")


def _resolve_blank_mxd():
    install_dir = arcpy.GetInstallInfo().get("InstallDir") or ""
    candidates = [
        os.path.join(install_dir, "MapTemplates", "Blank.mxd"),
        os.path.join(install_dir, "MapTemplates", "blank.mxd"),
        os.path.join(install_dir, "MapTemplates", "Traditional Layouts", "LetterLandscape.mxd"),
        os.path.join(install_dir, "MapTemplates", "Traditional Layouts", "LetterPortrait.mxd"),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    map_templates = os.path.join(install_dir, "MapTemplates")
    if os.path.isdir(map_templates):
        for root, _dirs, files in os.walk(map_templates):
            for name in files:
                if str(name).lower().endswith(".mxd"):
                    return os.path.join(root, name)
    return None


def _resolve_style_field(style_mode):
    mode = str(style_mode or "density").strip().lower()
    if mode == "gi_z":
        return "GI_Z"
    if mode == "lisa_i":
        return "LISA_I"
    return "DENSITY"


def _iter_valid_numbers(values):
    for val in values or []:
        num = _safe_float(val)
        if num is None:
            continue
        if num != num:
            continue
        yield float(num)


def _compute_break_values(values, bins):
    valid = sorted(_iter_valid_numbers(values))
    if len(valid) < 2:
        return None
    bins = max(3, min(7, int(bins)))
    break_values = []
    max_idx = len(valid) - 1
    for i in range(1, bins + 1):
        p = float(i) / float(bins)
        idx = int(round(p * max_idx))
        idx = max(0, min(max_idx, idx))
        break_values.append(valid[idx])
    deduped = []
    for v in break_values:
        if not deduped or abs(v - deduped[-1]) > 1e-12:
            deduped.append(v)
    if len(deduped) < 3:
        return None
    return deduped


def _pick_color_ramp(sym, style_mode):
    try:
        list_style_items = getattr(arcpy.mapping, "ListStyleItems", None)
        if not callable(list_style_items):
            return
        mode = str(style_mode or "density").strip().lower()
        if mode == "gi_z":
            name_candidates = ["Red to Blue", "Red-Blue", "Blue to Red"]
        elif mode == "lisa_i":
            name_candidates = ["Blue to Red", "Red to Blue", "Temperature"]
        else:
            name_candidates = ["Yellow to Red", "Light to Dark", "Blue to Green"]
        ramps = list_style_items("ESRI.style", "Color Ramps", "*") or []
        selected = None
        for candidate in name_candidates:
            for item in ramps:
                if candidate.lower() in str(getattr(item, "name", "")).lower():
                    selected = item
                    break
            if selected:
                break
        if selected is not None and hasattr(sym, "colorRamp"):
            sym.colorRamp = selected
    except Exception:
        return


def _apply_grid_symbology(layer_obj, grid_rows, style_mode):
    if layer_obj is None:
        return False
    try:
        sym = layer_obj.symbology
    except Exception:
        return False
    if sym is None:
        return False

    field_name = _resolve_style_field(style_mode)
    field_key = "density"
    if field_name == "GI_Z":
        field_key = "gi_z"
    elif field_name == "LISA_I":
        field_key = "lisa_i"
    values = [row.get(field_key) for row in (grid_rows or [])]
    breaks = _compute_break_values(values, bins=6)

    # ArcMap APIs vary by renderer type and version. Try best-effort and never fail export.
    try:
        if hasattr(sym, "updateRenderer"):
            try:
                sym.updateRenderer("GRADUATED_COLORS")
            except Exception:
                pass
        if hasattr(sym, "valueField"):
            sym.valueField = field_name
        if hasattr(sym, "classificationField"):
            sym.classificationField = field_name
        if hasattr(sym, "numClasses") and breaks:
            try:
                sym.numClasses = len(breaks)
            except Exception:
                pass
        if hasattr(sym, "classificationMethod"):
            try:
                # Quantile is robust for density-like distributions.
                sym.classificationMethod = "Quantile"
            except Exception:
                pass
        _pick_color_ramp(sym, style_mode)
        if hasattr(sym, "classBreakValues") and breaks:
            try:
                sym.classBreakValues = breaks
            except Exception:
                pass
        if hasattr(sym, "reclassify"):
            try:
                sym.reclassify()
            except Exception:
                pass
        layer_obj.symbology = sym
        return True
    except Exception:
        return False


def _export_arcgis_package(grid_fc, poi_fc, output_path, include_poi, style_mode, grid_rows):
    output_dir = os.path.dirname(output_path)
    if not os.path.isdir(output_dir):
        os.makedirs(output_dir)
    if os.path.exists(output_path):
        os.remove(output_path)

    work_dir = tempfile.mkdtemp(prefix="arcgis_pkg_")
    try:
        grid_lyr_name = "h3_grid_lyr"
        arcpy.MakeFeatureLayer_management(grid_fc, grid_lyr_name)
        grid_lyr_file = os.path.join(work_dir, "h3_grid.lyr")
        arcpy.SaveToLayerFile_management(grid_lyr_name, grid_lyr_file, "RELATIVE")

        poi_lyr_file = None
        if include_poi and poi_fc and arcpy.Exists(poi_fc):
            poi_lyr_name = "poi_points_lyr"
            arcpy.MakeFeatureLayer_management(poi_fc, poi_lyr_name)
            poi_lyr_file = os.path.join(work_dir, "poi_points.lyr")
            arcpy.SaveToLayerFile_management(poi_lyr_name, poi_lyr_file, "RELATIVE")

        blank_mxd = _resolve_blank_mxd()
        if not blank_mxd:
            raise RuntimeError("Blank.mxd not found in ArcGIS installation")
        mxd_path = os.path.join(work_dir, "h3_analysis.mxd")
        shutil.copy(blank_mxd, mxd_path)

        mxd = arcpy.mapping.MapDocument(mxd_path)
        try:
            data_frames = arcpy.mapping.ListDataFrames(mxd)
            if not data_frames:
                raise RuntimeError("No dataframe found in temporary mxd")
            df = data_frames[0]
            arcpy.mapping.AddLayer(df, arcpy.mapping.Layer(grid_lyr_file), "TOP")
            grid_layers = arcpy.mapping.ListLayers(mxd, "h3_grid*", df) or []
            if grid_layers:
                _apply_grid_symbology(grid_layers[0], grid_rows, style_mode)
                try:
                    arcpy.SaveToLayerFile_management(grid_layers[0], grid_lyr_file, "RELATIVE")
                except Exception:
                    pass
            if poi_lyr_file and os.path.exists(poi_lyr_file):
                arcpy.mapping.AddLayer(df, arcpy.mapping.Layer(poi_lyr_file), "TOP")
            try:
                mxd.title = "H3 Analysis Export"
            except Exception:
                pass
            try:
                mxd.summary = "H3 analysis package exported by ArcGIS bridge."
            except Exception:
                pass
            try:
                mxd.description = "Contains H3 grid and optional POI layers."
            except Exception:
                pass
            try:
                mxd.tags = "h3,analysis,arcgis,export"
            except Exception:
                pass
            mxd.save()
        finally:
            del mxd

        lpk_path = os.path.join(work_dir, "h3_analysis.lpk")
        arcpy.PackageLayer_management(grid_lyr_file, lpk_path)

        mpk_path = os.path.join(work_dir, "h3_analysis.mpk")
        arcpy.PackageMap_management(mxd_path, mpk_path)

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(lpk_path, "h3_analysis.lpk")
            zf.write(mpk_path, "h3_analysis.mpk")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def run_export(input_path, output_path, export_format, include_poi):
    payload = _read_json(input_path)
    grid_rows = _extract_grid_rows(payload)
    poi_rows = _extract_poi_rows(payload)
    if not grid_rows:
        features = payload.get("grid_features") or []
        geom_types = []
        for feature in features[:10]:
            geom = (feature or {}).get("geometry") or {}
            geom_types.append(str(geom.get("type") or ""))
        raise RuntimeError(
            "No valid grid feature to export (received=%d, geom_types=%s)"
            % (len(features), ",".join(geom_types) or "none")
        )

    tmp_dir = tempfile.mkdtemp(prefix="arcgis_h3_export_")
    try:
        gdb_name = "export_%s.gdb" % os.path.basename(tmp_dir)[-6:]
        gdb_path = arcpy.CreateFileGDB_management(tmp_dir, gdb_name).getOutput(0)
        grid_fc = _build_grid_fc(gdb_path, grid_rows)
        poi_fc = _build_poi_fc(gdb_path, poi_rows) if include_poi else None

        if export_format == "arcgis_package":
            _export_arcgis_package(
                grid_fc,
                poi_fc,
                output_path,
                include_poi,
                payload.get("style_mode"),
                grid_rows,
            )
        else:
            _export_gpkg(grid_fc, poi_fc, output_path, include_poi)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ArcGIS H3 exporter")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--format", choices=["gpkg", "arcgis_package"], default="gpkg")
    parser.add_argument("--include-poi", type=int, default=1)
    args = parser.parse_args()

    try:
        import arcpy

        arcpy.env.overwriteOutput = True
        run_export(
            input_path=args.input,
            output_path=args.output,
            export_format=args.format,
            include_poi=bool(int(args.include_poi)),
        )
        sys.exit(0)
    except Exception:
        traceback.print_exc()
        sys.exit(2)
