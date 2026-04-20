from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[2]))

import store.history_repo as history_repo_module
from store.history_repo import HistoryRepo
from store.models import AgentSession, AnalysisHistory, Base, PoiResult


def test_get_list_extracts_only_sidebar_params_from_sqlite(monkeypatch):
    engine = create_engine("sqlite:///:memory:", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        session.add(
            AnalysisHistory(
                description="长沙步行15分钟",
                params={
                    "center": [112.9388, 28.2282],
                    "time_min": 15,
                    "keywords": "咖啡店",
                    "mode": "walking",
                    "source": "local",
                    "h3_result": {
                        "grid": {
                            "type": "FeatureCollection",
                            "features": [{"type": "Feature", "properties": {"n": i}} for i in range(64)],
                        }
                    },
                    "road_result": {
                        "roads": {
                            "type": "FeatureCollection",
                            "features": [{"type": "Feature", "properties": {"n": i}} for i in range(64)],
                        }
                    },
                },
                result_polygon=[[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]],
            )
        )
        session.commit()
    finally:
        session.close()

    monkeypatch.setattr(history_repo_module, "SessionLocal", TestingSessionLocal)
    repo = HistoryRepo()

    records = repo.get_list()

    assert len(records) == 1
    assert records[0]["description"] == "长沙步行15分钟"
    assert records[0]["params"] == {
        "center": [112.9388, 28.2282],
        "time_min": 15,
        "keywords": "咖啡店",
        "mode": "walking",
        "source": "local",
    }


def test_get_list_dedupes_using_lightweight_sidebar_fields(monkeypatch):
    engine = create_engine("sqlite:///:memory:", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        session.add_all(
            [
                AnalysisHistory(
                    description="同一分析",
                    params={
                        "center": [112.9, 28.2],
                        "time_min": 15,
                        "keywords": "咖啡店",
                        "mode": "walking",
                        "source": "local",
                        "h3_result": {"grid": {"features": [{"id": 1}]}},
                    },
                ),
                AnalysisHistory(
                    description="同一分析",
                    params={
                        "center": [112.9, 28.2],
                        "time_min": 15,
                        "keywords": "咖啡店",
                        "mode": "walking",
                        "source": "local",
                        "road_result": {"roads": {"features": [{"id": 2}, {"id": 3}]}},
                    },
                ),
            ]
        )
        session.commit()
    finally:
        session.close()

    monkeypatch.setattr(history_repo_module, "SessionLocal", TestingSessionLocal)
    repo = HistoryRepo()

    records = repo.get_list()

    assert len(records) == 1


def test_get_list_includes_ai_session_count(monkeypatch):
    engine = create_engine("sqlite:///:memory:", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        history = AnalysisHistory(
            description="测试历史",
            params={
                "center": [112.9, 28.2],
                "time_min": 15,
                "keywords": "咖啡店",
                "mode": "walking",
                "source": "local",
            },
            result_polygon=[[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]],
        )
        session.add(history)
        session.flush()
        session.add(
            AgentSession(
                id="agent-1",
                title="总结",
                preview="summary",
                status="answered",
                snapshot={"_meta": {"analysis_fingerprint": f"history:{history.id}"}},
                is_pinned=False,
            )
        )
        session.commit()
    finally:
        session.close()

    monkeypatch.setattr(history_repo_module, "SessionLocal", TestingSessionLocal)
    repo = HistoryRepo()
    records = repo.get_list()
    assert len(records) == 1
    assert records[0]["ai_session_count"] == 1


def test_delete_record_removes_linked_agent_sessions(monkeypatch):
    engine = create_engine("sqlite:///:memory:", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        history = AnalysisHistory(
            description="测试历史",
            params={
                "center": [112.9, 28.2],
                "time_min": 15,
                "keywords": "咖啡店",
                "mode": "walking",
                "source": "local",
            },
            result_polygon=[[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]],
        )
        session.add(history)
        session.flush()
        session.add(
            PoiResult(
                history_id=history.id,
                poi_data=[{"name": "test"}],
                summary={"total": 1},
            )
        )
        session.add_all(
            [
                AgentSession(
                    id="agent-linked",
                    title="linked",
                    preview="linked",
                    status="answered",
                    snapshot={"_meta": {"analysis_fingerprint": f"history:{history.id}"}},
                    is_pinned=False,
                ),
                AgentSession(
                    id="agent-other",
                    title="other",
                    preview="other",
                    status="answered",
                    snapshot={"_meta": {"analysis_fingerprint": "scope:abc"}},
                    is_pinned=False,
                ),
            ]
        )
        session.commit()
        target_id = int(history.id)
    finally:
        session.close()

    monkeypatch.setattr(history_repo_module, "SessionLocal", TestingSessionLocal)
    repo = HistoryRepo()
    assert repo.delete_record(target_id) is True

    verify = TestingSessionLocal()
    try:
        assert verify.query(AnalysisHistory).filter_by(id=target_id).count() == 0
        assert verify.query(PoiResult).filter_by(history_id=target_id).count() == 0
        assert verify.query(AgentSession).filter_by(id="agent-linked").count() == 0
        assert verify.query(AgentSession).filter_by(id="agent-other").count() == 1
    finally:
        verify.close()
