from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append(str(Path(__file__).resolve().parents[2]))

import store.history_repo as history_repo_module
from store.history_repo import HistoryRepo
from store.history_keys import build_history_record_id
from store.models import AgentSession, AnalysisHistory, Base, PoiResult


def _install_repo(monkeypatch):
    engine = create_engine("sqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(history_repo_module, "SessionLocal", testing_session_local)
    return HistoryRepo(), testing_session_local


def _build_history(params, polygon, *, description, history_id=None):
    return AnalysisHistory(
        id=history_id or build_history_record_id(params, polygon),
        description=description,
        params=params,
        result_polygon=polygon,
    )


def test_get_list_extracts_only_sidebar_params_from_sqlite(monkeypatch):
    repo, testing_session_local = _install_repo(monkeypatch)

    session = testing_session_local()
    try:
        params = {
            "center": [112.9388, 28.2282],
            "time_min": 15,
            "keywords": "咖啡店",
            "mode": "walking",
            "source": "local",
            "h3_result": {"grid": {"features": [{"id": i} for i in range(64)]}},
            "road_result": {"roads": {"features": [{"id": i} for i in range(64)]}},
        }
        polygon = [[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]]
        session.add(
            _build_history(params, polygon, description="长沙步行 15 分钟")
        )
        session.commit()
    finally:
        session.close()

    records = repo.get_list()

    assert len(records) == 1
    assert records[0]["description"] == "长沙步行 15 分钟"
    assert records[0]["params"] == {
        "center": [112.9388, 28.2282],
        "time_min": 15,
        "keywords": "咖啡店",
        "mode": "walking",
        "source": "local",
    }


def test_get_list_dedupes_using_lightweight_sidebar_fields(monkeypatch):
    repo, testing_session_local = _install_repo(monkeypatch)

    session = testing_session_local()
    try:
        shared_params = {
            "center": [112.9, 28.2],
            "time_min": 15,
            "keywords": "咖啡店",
            "mode": "walking",
            "source": "local",
        }
        session.add_all(
            [
                _build_history(
                    {**shared_params, "h3_result": {"grid": {"features": [{"id": 1}]}}},
                    [],
                    description="同一分析",
                    history_id="history-dedupe-1",
                ),
                _build_history(
                    {**shared_params, "road_result": {"roads": {"features": [{"id": 2}, {"id": 3}]}}},
                    [],
                    description="同一分析",
                    history_id="history-dedupe-2",
                ),
            ]
        )
        session.commit()
    finally:
        session.close()

    records = repo.get_list()

    assert len(records) == 1


def test_get_list_includes_ai_session_count(monkeypatch):
    repo, testing_session_local = _install_repo(monkeypatch)

    session = testing_session_local()
    try:
        params = {
            "center": [112.9, 28.2],
            "time_min": 15,
            "keywords": "咖啡店",
            "mode": "walking",
            "source": "local",
        }
        polygon = [[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]]
        history = _build_history(params, polygon, description="测试历史")
        session.add(history)
        session.flush()
        session.add(
            AgentSession(
                id="agent-1",
                title="总结",
                preview="summary",
                status="answered",
                history_id=history.id,
                panel_kind="commercial_summary",
                snapshot={"_meta": {"history_id": history.id}},
                is_pinned=False,
            )
        )
        session.commit()
    finally:
        session.close()

    records = repo.get_list()

    assert len(records) == 1
    assert records[0]["ai_session_count"] == 1


def test_delete_record_removes_linked_agent_sessions(monkeypatch):
    repo, testing_session_local = _install_repo(monkeypatch)

    session = testing_session_local()
    try:
        params = {
            "center": [112.9, 28.2],
            "time_min": 15,
            "keywords": "咖啡店",
            "mode": "walking",
            "source": "local",
        }
        polygon = [[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]]
        history = _build_history(params, polygon, description="测试历史")
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
                    history_id=history.id,
                    panel_kind="commercial_summary",
                    snapshot={"_meta": {"history_id": history.id}},
                    is_pinned=False,
                ),
                AgentSession(
                    id="agent-other",
                    title="other",
                    preview="other",
                    status="answered",
                    history_id="other-history",
                    panel_kind="followup",
                    snapshot={"_meta": {"history_id": "other-history"}},
                    is_pinned=False,
                ),
            ]
        )
        session.commit()
        target_id = history.id
    finally:
        session.close()

    assert repo.delete_record(target_id) is True

    verify = testing_session_local()
    try:
        assert verify.query(AnalysisHistory).filter_by(id=target_id).count() == 0
        assert verify.query(PoiResult).filter_by(history_id=target_id).count() == 0
        assert verify.query(AgentSession).filter_by(id="agent-linked").count() == 0
        assert verify.query(AgentSession).filter_by(id="agent-other").count() == 1
    finally:
        verify.close()


def test_create_record_reuses_existing_preferred_history_id(monkeypatch):
    repo, testing_session_local = _install_repo(monkeypatch)

    session = testing_session_local()
    try:
        session.add(
            _build_history(
                {
                    "center": [112.9, 28.2],
                    "time_min": 15,
                    "keywords": "咖啡店",
                    "mode": "walking",
                    "source": "local",
                },
                [[112.9, 28.2], [113.0, 28.3], [112.9, 28.2]],
                description="old",
                history_id="history-fixed",
            )
        )
        session.commit()
    finally:
        session.close()

    returned_id = repo.create_record(
        {
            "center": [112.91, 28.21],
            "time_min": 30,
            "keywords": "餐饮",
            "mode": "walking",
            "source": "local",
        },
        [[120.1, 30.1], [120.2, 30.2], [120.1, 30.1]],
        [],
        "updated",
        preferred_history_id="history-fixed",
    )

    assert returned_id == "history-fixed"

    verify = testing_session_local()
    try:
        history = verify.query(AnalysisHistory).filter_by(id="history-fixed").first()
        assert history is not None
        assert history.description == "updated"
        assert history.result_polygon == [[120.1, 30.1], [120.2, 30.2], [120.1, 30.1]]
    finally:
        verify.close()
