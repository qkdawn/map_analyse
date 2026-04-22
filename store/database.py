"""
数据库连接与初始化。
"""

from __future__ import annotations

import logging
from pathlib import Path
from datetime import datetime

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from core.config import settings
from .history_keys import (
    build_history_record_id,
    coerce_json_value,
)
from .models import AgentSession, AnalysisHistory, Base, PoiResult

logger = logging.getLogger(__name__)


def _build_engine(db_uri: str | None = None):
    """
    构建 SQLAlchemy 引擎并确保数据目录存在。
    """
    effective_db_uri = db_uri or settings.sqlalchemy_database_uri
    connect_args = {}
    if "sqlite" in effective_db_uri:
        db_path = Path(settings.db_path).resolve()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        connect_args = {"check_same_thread": False}

    return create_engine(
        effective_db_uri,
        connect_args=connect_args,
        future=True,
        pool_pre_ping=True,  # Auto-reconnect
        pool_recycle=3600,
    )


engine = _build_engine()
SessionLocal = sessionmaker(autoflush=False, autocommit=False, future=True)
SessionLocal.configure(bind=engine)


def _history_tables_need_hash_migration() -> bool:
    inspector = inspect(engine)
    if not inspector.has_table("analysis_history"):
        return False
    id_column = next((item for item in inspector.get_columns("analysis_history") if item.get("name") == "id"), None)
    if not id_column:
        return False
    return "INT" in str(id_column.get("type") or "").upper()


def _history_row_rank(row: dict) -> tuple[str, str]:
    return (str(row.get("created_at") or ""), str(row.get("legacy_id") or ""))


def _coerce_datetime_value(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    text_value = str(value or "").strip()
    if not text_value:
        return datetime.utcnow()
    for candidate in (text_value, text_value.replace("Z", "+00:00")):
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            continue
    return datetime.utcnow()


def _rewrite_agent_snapshot_history_id(snapshot: object, old_to_new_history_id: dict[str, str]) -> dict | None:
    if not isinstance(snapshot, dict):
        return None
    payload = dict(snapshot)
    meta = payload.get("_meta")
    if not isinstance(meta, dict):
        meta = {}
    else:
        meta = dict(meta)
    raw_history_id = str(meta.get("history_id") or "").strip()
    next_history_id = old_to_new_history_id.get(raw_history_id, raw_history_id)
    if next_history_id == raw_history_id:
        return None
    meta["history_id"] = next_history_id
    payload["_meta"] = meta
    return payload


def _migrate_history_tables_to_hash_ids() -> None:
    if not _history_tables_need_hash_migration():
        return
    logger.info("检测到 analysis_history 仍为整数主键，开始迁移到稳定哈希主键")
    with engine.begin() as connection:
        history_rows = [
            dict(row)
            for row in connection.execute(
                text("SELECT id, created_at, params, result_polygon, description FROM analysis_history")
            ).mappings().all()
        ]
        poi_rows = []
        inspector = inspect(connection)
        if inspector.has_table("poi_results"):
            poi_rows = [
                dict(row)
                for row in connection.execute(
                    text("SELECT id, history_id, poi_data, summary, created_at FROM poi_results")
                ).mappings().all()
            ]

        history_by_hash: dict[str, dict] = {}
        old_to_new_history_id: dict[str, str] = {}
        for row in history_rows:
            params = coerce_json_value(row.get("params"))
            polygon = coerce_json_value(row.get("result_polygon"))
            new_id = build_history_record_id(params if isinstance(params, dict) else {}, polygon)
            legacy_id = str(row.get("id") or "").strip()
            if legacy_id:
                old_to_new_history_id[legacy_id] = new_id
            candidate = {
                "id": new_id,
                "created_at": row.get("created_at"),
                "params": params if isinstance(params, dict) else {},
                "result_polygon": polygon,
                "description": row.get("description"),
                "legacy_id": legacy_id,
            }
            existing = history_by_hash.get(new_id)
            if existing is None or _history_row_rank(candidate) >= _history_row_rank(existing):
                history_by_hash[new_id] = candidate

        poi_by_history_hash: dict[str, dict] = {}
        for row in poi_rows:
            legacy_history_id = str(row.get("history_id") or "").strip()
            new_history_id = old_to_new_history_id.get(legacy_history_id)
            if not new_history_id:
                continue
            candidate = {
                "history_id": new_history_id,
                "poi_data": coerce_json_value(row.get("poi_data")) or [],
                "summary": coerce_json_value(row.get("summary")) or {},
                "created_at": row.get("created_at"),
                "legacy_id": str(row.get("id") or "").strip(),
            }
            existing = poi_by_history_hash.get(new_history_id)
            if existing is None or _history_row_rank(candidate) >= _history_row_rank(existing):
                poi_by_history_hash[new_history_id] = candidate

        if inspector.has_table("poi_results"):
            connection.execute(text("DROP TABLE poi_results"))
        if inspector.has_table("analysis_history"):
            connection.execute(text("DROP TABLE analysis_history"))

        Base.metadata.create_all(bind=connection, tables=[AnalysisHistory.__table__, PoiResult.__table__])

        if history_by_hash:
            connection.execute(
                AnalysisHistory.__table__.insert(),
                [
                    {
                        "id": row["id"],
                        "created_at": _coerce_datetime_value(row.get("created_at")),
                        "params": row.get("params") or {},
                        "result_polygon": row.get("result_polygon"),
                        "description": row.get("description"),
                    }
                    for row in history_by_hash.values()
                ],
            )
        if poi_by_history_hash:
            connection.execute(
                PoiResult.__table__.insert(),
                [
                    {
                        "history_id": row["history_id"],
                        "poi_data": row.get("poi_data") or [],
                        "summary": row.get("summary") or {},
                        "created_at": _coerce_datetime_value(row.get("created_at")),
                    }
                    for row in poi_by_history_hash.values()
                ],
            )

        if inspector.has_table("agent_sessions"):
            session_rows = connection.execute(
                text("SELECT id, snapshot FROM agent_sessions")
            ).mappings().all()
            for row in session_rows:
                snapshot = coerce_json_value(row.get("snapshot"))
                next_snapshot = _rewrite_agent_snapshot_history_id(snapshot, old_to_new_history_id)
                if next_snapshot is None:
                    continue
                connection.execute(
                    AgentSession.__table__.update()
                    .where(AgentSession.id == str(row.get("id") or ""))
                    .values(snapshot=next_snapshot)
                )
    logger.info("analysis_history / poi_results 已迁移到稳定哈希主键")


def init_db() -> None:
    """
    创建表结构（幂等）。
    """
    _migrate_history_tables_to_hash_ids()
    Base.metadata.create_all(bind=engine)
    logger.info("数据库初始化完成: %s", settings.db_path)
