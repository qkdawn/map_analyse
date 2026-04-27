from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from modules.history.service import (
    build_detail_payload,
    build_history_list_dedupe_key,
    build_list_params_from_params,
    serialize_created_at,
)
from .history_keys import (
    build_history_record_id,
)
from .database import SessionLocal
from .models import AgentSession, AnalysisHistory, PoiResult


class HistoryRepo:
    @staticmethod
    def _build_history_agent_count_map(session: Session) -> Dict[str, int]:
        rows = session.query(AgentSession.history_id).all()
        counter: Dict[str, int] = {}
        for row in rows:
            history_id = str(row.history_id or "").strip()
            if not history_id:
                continue
            counter[history_id] = int(counter.get(history_id, 0)) + 1
        return counter

    def create_record(
        self,
        params: Dict,
        polygon: List,
        pois: List[Dict],
        description: str = "",
        *,
        preferred_history_id: str = "",
    ) -> str:
        session: Session = SessionLocal()
        try:
            history_id = str(preferred_history_id or "").strip()
            history = session.get(AnalysisHistory, history_id) if history_id else None
            if history is None:
                history_id = build_history_record_id(params, polygon)
                history = session.get(AnalysisHistory, history_id)
            if history is None:
                history = AnalysisHistory(
                    id=history_id,
                    params=params,
                    result_polygon=polygon,
                    description=description,
                    created_at=datetime.utcnow(),
                )
                session.add(history)
            else:
                history.params = params
                history.result_polygon = polygon
                history.description = description
                history.created_at = datetime.utcnow()

            poi_record = session.query(PoiResult).filter_by(history_id=history_id).first()
            if pois:
                if poi_record is None:
                    poi_record = PoiResult(
                        history_id=history_id,
                        poi_data=pois,
                        summary={"total": len(pois)},
                    )
                    session.add(poi_record)
                else:
                    poi_record.poi_data = pois
                    poi_record.summary = {"total": len(pois)}
                    poi_record.created_at = datetime.utcnow()
            elif poi_record is not None:
                session.delete(poi_record)

            session.commit()
            return history_id
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_list(self, limit: int = 0) -> List[Dict]:
        session: Session = SessionLocal()
        try:
            ai_count_map = self._build_history_agent_count_map(session)
            query = (
                session.query(
                    AnalysisHistory.id,
                    AnalysisHistory.description,
                    AnalysisHistory.created_at,
                )
                .order_by(desc(AnalysisHistory.created_at))
            )
            if isinstance(limit, int) and limit > 0:
                query = query.limit(limit)
            records = query.all()
            history_ids = [str(row.id) for row in records]
            params_by_id = {
                str(row.id): row.params
                for row in session.query(AnalysisHistory.id, AnalysisHistory.params)
                .filter(AnalysisHistory.id.in_(history_ids))
                .all()
            } if history_ids else {}

            result = []
            seen_keys = set()
            for row in records:
                list_params = build_list_params_from_params(params_by_id.get(str(row.id)))
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
                        "ai_session_count": int(ai_count_map.get(str(row.id), 0)),
                    }
                )
            return result
        finally:
            session.close()

    def get_detail(self, history_id: str, include_pois: bool = True) -> Optional[Dict]:
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

    def get_pois(self, history_id: str) -> Optional[Dict]:
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

    def delete_record(self, history_id: str) -> bool:
        session: Session = SessionLocal()
        try:
            target_history_id = str(history_id).strip()
            session.query(AgentSession).filter_by(history_id=target_history_id).delete()
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
