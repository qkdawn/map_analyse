from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from modules.history.service import (
    build_detail_payload,
    build_history_list_dedupe_key,
    build_history_overwrite_key,
    build_lightweight_list_params,
    build_list_params_from_params,
    serialize_created_at,
)
from .database import SessionLocal
from .models import AgentSession, AnalysisHistory, PoiResult


class HistoryRepo:
    @staticmethod
    def _extract_analysis_fingerprint(snapshot: Any) -> str:
        if not isinstance(snapshot, dict):
            return ""
        meta = snapshot.get("_meta")
        if not isinstance(meta, dict):
            return ""
        return str(meta.get("analysis_fingerprint") or "").strip()

    @staticmethod
    def _build_history_agent_count_map(session: Session) -> Dict[int, int]:
        rows = session.query(AgentSession.id, AgentSession.snapshot).all()
        counter: Dict[int, int] = {}
        for _, snapshot in rows:
            fingerprint = HistoryRepo._extract_analysis_fingerprint(snapshot)
            if not fingerprint.startswith("history:"):
                continue
            raw_id = fingerprint.split(":", 1)[1].strip()
            try:
                history_id = int(raw_id)
            except (TypeError, ValueError):
                continue
            counter[history_id] = int(counter.get(history_id, 0)) + 1
        return counter

    @staticmethod
    def _json_extract_expr(dialect_name: str, path: str):
        extracted = func.json_extract(AnalysisHistory.params, path)
        if dialect_name == "mysql":
            return func.json_unquote(extracted)
        return extracted

    def _find_same_history_ids_for_overwrite(self, session: Session, params: Dict[str, Any]) -> List[int]:
        incoming_key = build_history_overwrite_key(build_list_params_from_params(params))
        rows = (
            session.query(AnalysisHistory.id, AnalysisHistory.params)
            .order_by(desc(AnalysisHistory.id))
            .all()
        )
        matched_ids: List[int] = []
        for row in rows:
            row_key = build_history_overwrite_key(build_list_params_from_params(row.params))
            if row_key == incoming_key:
                matched_ids.append(int(row.id))
        return matched_ids

    def create_record(self, params: Dict, polygon: List, pois: List[Dict], description: str = "") -> int:
        session: Session = SessionLocal()
        try:
            same_ids = self._find_same_history_ids_for_overwrite(session, params)
            if same_ids:
                session.query(PoiResult).filter(PoiResult.history_id.in_(same_ids)).delete(synchronize_session=False)
                session.query(AnalysisHistory).filter(AnalysisHistory.id.in_(same_ids)).delete(synchronize_session=False)

            history = AnalysisHistory(
                params=params,
                result_polygon=polygon,
                description=description,
                created_at=datetime.utcnow(),
            )
            session.add(history)
            session.flush()

            if pois:
                session.add(
                    PoiResult(
                        history_id=history.id,
                        poi_data=pois,
                        summary={"total": len(pois)},
                    )
                )

            session.commit()
            return history.id
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_list(self, limit: int = 0) -> List[Dict]:
        session: Session = SessionLocal()
        try:
            ai_count_map = self._build_history_agent_count_map(session)
            bind = session.get_bind()
            dialect_name = bind.dialect.name if bind is not None else ""
            if dialect_name in {"mysql", "sqlite"}:
                query = (
                    session.query(
                        AnalysisHistory.id,
                        AnalysisHistory.description,
                        AnalysisHistory.created_at,
                        self._json_extract_expr(dialect_name, "$.center").label("center"),
                        self._json_extract_expr(dialect_name, "$.time_min").label("time_min"),
                        self._json_extract_expr(dialect_name, "$.keywords").label("keywords"),
                        self._json_extract_expr(dialect_name, "$.mode").label("mode"),
                        self._json_extract_expr(dialect_name, "$.source").label("source"),
                    )
                    .order_by(desc(AnalysisHistory.id))
                )
                build_list_params = build_lightweight_list_params
            else:
                query = (
                    session.query(
                        AnalysisHistory.id,
                        AnalysisHistory.description,
                        AnalysisHistory.created_at,
                        AnalysisHistory.params,
                    )
                    .order_by(desc(AnalysisHistory.id))
                )
                build_list_params = lambda row: build_list_params_from_params(row.params)
            if isinstance(limit, int) and limit > 0:
                query = query.limit(limit)
            records = query.all()

            result = []
            seen_keys = set()
            for row in records:
                list_params = build_list_params(row)
                dedupe_key = build_history_list_dedupe_key(row.description, list_params)
                if dedupe_key in seen_keys:
                    continue
                seen_keys.add(dedupe_key)
                result.append(
                    {
                        "id": row.id,
                        "description": row.description,
                        "created_at": serialize_created_at(row.created_at),
                        "params": list_params,
                        "ai_session_count": int(ai_count_map.get(int(row.id), 0)),
                    }
                )
            return result
        finally:
            session.close()

    def get_detail(self, history_id: int, include_pois: bool = True) -> Optional[Dict]:
        session: Session = SessionLocal()
        try:
            history = session.query(AnalysisHistory).filter_by(id=history_id).first()
            if not history:
                return None
            if include_pois:
                poi_res = session.query(PoiResult).filter_by(history_id=history_id).first()
                pois = poi_res.poi_data if poi_res and isinstance(poi_res.poi_data, list) else []
                poi_summary = poi_res.summary if poi_res and isinstance(poi_res.summary, dict) else {}
                return build_detail_payload(
                    history,
                    pois=pois,
                    poi_summary=poi_summary,
                    poi_count=len(pois),
                )

            poi_row = session.query(PoiResult.summary).filter_by(history_id=history_id).first()
            poi_summary = poi_row[0] if poi_row and isinstance(poi_row[0], dict) else {}
            poi_count = int(poi_summary.get("total") or 0) if isinstance(poi_summary, dict) else 0
            return build_detail_payload(
                history,
                poi_summary=poi_summary if isinstance(poi_summary, dict) else {},
                poi_count=poi_count,
            )
        finally:
            session.close()

    def get_pois(self, history_id: int) -> Optional[Dict]:
        session: Session = SessionLocal()
        try:
            history_exists = session.query(AnalysisHistory.id).filter_by(id=history_id).first()
            if not history_exists:
                return None
            poi_res = session.query(PoiResult).filter_by(history_id=history_id).first()
            pois = poi_res.poi_data if poi_res and isinstance(poi_res.poi_data, list) else []
            poi_summary = poi_res.summary if poi_res and isinstance(poi_res.summary, dict) else {}
            return {"history_id": history_id, "pois": pois, "poi_summary": poi_summary, "count": len(pois)}
        finally:
            session.close()

    def delete_record(self, history_id: int) -> bool:
        session: Session = SessionLocal()
        try:
            target_fingerprint = f"history:{int(history_id)}"
            linked_agent_ids: List[str] = []
            for row in session.query(AgentSession.id, AgentSession.snapshot).all():
                fingerprint = self._extract_analysis_fingerprint(row.snapshot)
                if fingerprint == target_fingerprint:
                    linked_agent_ids.append(str(row.id))
            if linked_agent_ids:
                session.query(AgentSession).filter(AgentSession.id.in_(linked_agent_ids)).delete(synchronize_session=False)
            session.query(PoiResult).filter_by(history_id=history_id).delete()
            rows = session.query(AnalysisHistory).filter_by(id=history_id).delete()
            session.commit()
            return rows > 0
        except Exception:
            session.rollback()
            return False
        finally:
            session.close()


history_repo = HistoryRepo()
