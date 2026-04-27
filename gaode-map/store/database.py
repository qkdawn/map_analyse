"""
数据库连接与初始化。
"""

from __future__ import annotations

import logging

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from core.config import settings
from .models import AgentSession, Base

logger = logging.getLogger(__name__)


def _build_engine(db_uri: str | None = None):
    """
    构建 SQLAlchemy 引擎。
    """
    effective_db_uri = db_uri or settings.sqlalchemy_database_uri
    if effective_db_uri.lower().startswith("sqlite"):
        raise ValueError("SQLite is no longer supported. Configure DB_URL with mysql+pymysql://...")

    return create_engine(
        effective_db_uri,
        future=True,
        pool_pre_ping=True,  # Auto-reconnect
        pool_recycle=3600,
    )


engine = _build_engine()
SessionLocal = sessionmaker(autoflush=False, autocommit=False, future=True)
SessionLocal.configure(bind=engine)


def _ensure_agent_sessions_schema() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("agent_sessions"):
        AgentSession.__table__.create(bind=engine, checkfirst=True)
        return

    columns = {item.get("name") for item in inspector.get_columns("agent_sessions")}
    if {"history_id", "panel_kind"}.issubset(columns):
        for index in AgentSession.__table__.indexes:
            index.create(bind=engine, checkfirst=True)
        return

    logger.warning("agent_sessions 缺少面板历史字段，将按新结构重建并丢弃旧 AI 历史")
    AgentSession.__table__.drop(bind=engine, checkfirst=True)
    AgentSession.__table__.create(bind=engine, checkfirst=True)


def init_db() -> None:
    """
    创建表结构（幂等）。
    """
    Base.metadata.create_all(bind=engine)
    _ensure_agent_sessions_schema()
    logger.info("数据库初始化完成")
