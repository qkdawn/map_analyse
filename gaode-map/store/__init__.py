"""
数据库存储模块入口。

保持入口轻量，避免导入 `store.<submodule>` 时把所有仓储实现一并加载。
"""

from __future__ import annotations

from importlib import import_module

from .database import init_db
from .models import AgentSession, AnalysisHistory, MapData, MapPolygonLink, PoiResult, PolygonData

_LAZY_EXPORTS = {
    "build_center_fingerprint": (".fingerprint", "build_center_fingerprint"),
    "delete_polygon": (".polygon_repo", "delete_polygon"),
    "list_polygons_for_map": (".polygon_repo", "list_polygons_for_map"),
    "save_polygon": (".polygon_repo", "save_polygon"),
    "delete_map": (".map_repo", "delete_map"),
    "find_map_by_center_and_type": (".map_repo", "find_map_by_center_and_type"),
    "find_map_by_fingerprint": (".map_repo", "find_map_by_fingerprint"),
    "get_map_data": (".map_repo", "get_map_data"),
    "list_maps_with_polygons": (".map_repo", "list_maps_with_polygons"),
    "save_map_data": (".map_repo", "save_map_data"),
}


def __getattr__(name: str):
    target = _LAZY_EXPORTS.get(name)
    if target is None:
        raise AttributeError(f"module 'store' has no attribute {name!r}")
    module_name, attr_name = target
    module = import_module(module_name, __name__)
    value = getattr(module, attr_name)
    globals()[name] = value
    return value


__all__ = [
    "AgentSession",
    "AnalysisHistory",
    "MapData",
    "MapPolygonLink",
    "PoiResult",
    "PolygonData",
    "build_center_fingerprint",
    "delete_map",
    "delete_polygon",
    "find_map_by_center_and_type",
    "find_map_by_fingerprint",
    "get_map_data",
    "init_db",
    "list_maps_with_polygons",
    "list_polygons_for_map",
    "save_map_data",
    "save_polygon",
]
