from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import AgentSession


def _clone_json_payload(payload: Any) -> Any:
    if isinstance(payload, dict):
        return {key: _clone_json_payload(value) for key, value in payload.items()}
    if isinstance(payload, list):
        return [_clone_json_payload(item) for item in payload]
    return payload


def _normalize_title_source(value: Any) -> str:
    source = str(value or "").strip().lower()
    if source in {"user", "ai", "fallback"}:
        return source
    return "fallback"


def _extract_snapshot_meta(snapshot: Any) -> Dict[str, Any]:
    if not isinstance(snapshot, dict):
        return {}
    meta = snapshot.get("_meta")
    return meta if isinstance(meta, dict) else {}


def _normalize_session_kind(value: Any) -> str:
    kind = str(value or "").strip().lower()
    if kind in {"summary", "followup"}:
        return kind
    return ""


def _extract_snapshot_session_flags(snapshot: Any) -> tuple[str, bool, bool]:
    if not isinstance(snapshot, dict):
        return "", False, False
    meta = _extract_snapshot_meta(snapshot)
    session_kind = _normalize_session_kind(meta.get("session_kind"))
    output = snapshot.get("output") if isinstance(snapshot.get("output"), dict) else {}
    panel_payloads = output.get("panel_payloads") if isinstance(output.get("panel_payloads"), dict) else {}
    summary_pack = panel_payloads.get("summary_pack") if isinstance(panel_payloads.get("summary_pack"), dict) else {}
    has_summary_pack = bool(summary_pack)
    messages = snapshot.get("messages")
    has_followup_messages = False
    if isinstance(messages, list):
        for row in messages:
            if not isinstance(row, dict):
                continue
            if str(row.get("role") or "").strip() != "user":
                continue
            if str(row.get("content") or "").strip():
                has_followup_messages = True
                break
    if not session_kind:
        if has_summary_pack and not has_followup_messages:
            session_kind = "summary"
        elif has_followup_messages:
            session_kind = "followup"
    return session_kind, has_summary_pack, has_followup_messages


class AgentSessionRepo:
    @staticmethod
    def _build_summary_payload(record: AgentSession) -> Dict[str, Any]:
        snapshot = record.snapshot if isinstance(record.snapshot, dict) else {}
        meta = _extract_snapshot_meta(snapshot)
        session_kind, has_summary_pack, has_followup_messages = _extract_snapshot_session_flags(snapshot)
        return {
            "id": str(record.id or ""),
            "title": str(record.title or ""),
            "preview": str(record.preview or ""),
            "status": str(record.status or "idle"),
            "analysis_fingerprint": str(meta.get("analysis_fingerprint") or ""),
            "is_pinned": bool(record.is_pinned),
            "title_source": _normalize_title_source(meta.get("title_source")),
            "session_kind": session_kind,
            "has_summary_pack": has_summary_pack,
            "has_followup_messages": has_followup_messages,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "pinned_at": record.pinned_at,
        }

    def _build_detail_payload(self, record: AgentSession) -> Dict[str, Any]:
        payload = self._build_summary_payload(record)
        payload["snapshot"] = _clone_json_payload(record.snapshot if isinstance(record.snapshot, dict) else {})
        return payload

    def list_records(self) -> List[Dict[str, Any]]:
        session: Session = SessionLocal()
        try:
            rows = (
                session.query(AgentSession)
                .order_by(
                    desc(AgentSession.is_pinned),
                    desc(AgentSession.pinned_at),
                    desc(AgentSession.updated_at),
                    desc(AgentSession.created_at),
                )
                .all()
            )
            return [self._build_summary_payload(row) for row in rows]
        finally:
            session.close()

    def get_record(self, session_id: str) -> Optional[Dict[str, Any]]:
        session: Session = SessionLocal()
        try:
            record = session.get(AgentSession, session_id)
            if record is None:
                return None
            return self._build_detail_payload(record)
        finally:
            session.close()

    def upsert_record(
        self,
        session_id: str,
        *,
        title: str,
        preview: str,
        status: str,
        snapshot: Dict[str, Any],
        is_pinned: Optional[bool] = None,
        title_source: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.utcnow()
        session: Session = SessionLocal()
        try:
            record = session.get(AgentSession, session_id)
            if record is None:
                record = AgentSession(
                    id=session_id,
                    created_at=now,
                    is_pinned=bool(is_pinned) if is_pinned is not None else False,
                )
                session.add(record)
            if is_pinned is not None:
                next_is_pinned = bool(is_pinned)
                if next_is_pinned and not record.is_pinned:
                    record.pinned_at = now
                elif not next_is_pinned:
                    record.pinned_at = None
                record.is_pinned = next_is_pinned
            elif record.is_pinned and record.pinned_at is None:
                record.pinned_at = now
            record.title = title
            record.preview = preview
            record.status = status
            next_snapshot = _clone_json_payload(snapshot if isinstance(snapshot, dict) else {})
            next_meta = {
                **_extract_snapshot_meta(record.snapshot),
                **_extract_snapshot_meta(next_snapshot),
            }
            if title_source is not None:
                next_meta["title_source"] = _normalize_title_source(title_source)
            elif not next_meta.get("title_source"):
                next_meta["title_source"] = "fallback"
            next_snapshot["_meta"] = next_meta
            record.snapshot = next_snapshot
            record.updated_at = now
            session.commit()
            session.refresh(record)
            return self._build_detail_payload(record)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def update_metadata(
        self,
        session_id: str,
        *,
        title: Optional[str] = None,
        is_pinned: Optional[bool] = None,
        title_source: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        now = datetime.utcnow()
        session: Session = SessionLocal()
        try:
            record = session.get(AgentSession, session_id)
            if record is None:
                return None
            if title is not None:
                record.title = title
            snapshot = _clone_json_payload(record.snapshot if isinstance(record.snapshot, dict) else {})
            meta = _extract_snapshot_meta(snapshot)
            if title_source is not None:
                meta["title_source"] = _normalize_title_source(title_source)
            elif title is not None:
                meta["title_source"] = "user"
            if meta:
                snapshot["_meta"] = meta
                record.snapshot = snapshot
            if is_pinned is not None:
                next_is_pinned = bool(is_pinned)
                if next_is_pinned and not record.is_pinned:
                    record.pinned_at = now
                elif not next_is_pinned:
                    record.pinned_at = None
                record.is_pinned = next_is_pinned
            elif record.is_pinned and record.pinned_at is None:
                record.pinned_at = now

            record.updated_at = now
            session.commit()
            session.refresh(record)
            return self._build_detail_payload(record)
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def delete_record(self, session_id: str) -> bool:
        session: Session = SessionLocal()
        try:
            rows = session.query(AgentSession).filter_by(id=session_id).delete()
            session.commit()
            return rows > 0
        except Exception:
            session.rollback()
            return False
        finally:
            session.close()


agent_session_repo = AgentSessionRepo()
