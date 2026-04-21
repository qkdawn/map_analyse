from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .database import SessionLocal
from .history_keys import (
    build_scope_fingerprint_from_polygon,
    coerce_json_value,
    extract_history_key_from_fingerprint,
)
from .models import AgentSession, AnalysisHistory


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


def _coerce_json_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return ""
        try:
            decoded = json.loads(text)
        except (TypeError, ValueError):
            return text
        return str(decoded or "").strip() if not isinstance(decoded, (dict, list)) else text
    return str(value).strip()


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = _coerce_json_text(value).lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off", "null", ""}:
        return False
    return bool(text)


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
    def _resolve_analysis_fingerprint(
        raw_fingerprint: Any,
        snapshot: Any,
        history_id_by_scope: Optional[Dict[str, str]] = None,
    ) -> str:
        raw_text = _coerce_json_text(raw_fingerprint)
        history_key = extract_history_key_from_fingerprint(raw_text)
        if history_key:
            return f"history:{history_key}"
        direct_scope = build_scope_fingerprint_from_polygon(((snapshot or {}).get("scope") or {}).get("polygon"))
        if direct_scope and isinstance(history_id_by_scope, dict) and direct_scope in history_id_by_scope:
            return f"history:{history_id_by_scope[direct_scope]}"
        direct_drawn = build_scope_fingerprint_from_polygon(((snapshot or {}).get("scope") or {}).get("drawn_polygon"))
        if direct_drawn and isinstance(history_id_by_scope, dict) and direct_drawn in history_id_by_scope:
            return f"history:{history_id_by_scope[direct_drawn]}"
        if raw_text.startswith("scope:") and isinstance(history_id_by_scope, dict) and raw_text in history_id_by_scope:
            return f"history:{history_id_by_scope[raw_text]}"
        return raw_text or direct_scope or direct_drawn

    @staticmethod
    def _resolve_summary_flags(payload: Dict[str, Any]) -> Dict[str, Any]:
        session_kind = _normalize_session_kind(payload.get("session_kind"))
        has_summary_pack = _coerce_bool(payload.get("has_summary_pack"))
        has_followup_messages = _coerce_bool(payload.get("has_followup_messages"))
        if not session_kind:
            if has_summary_pack and not has_followup_messages:
                session_kind = "summary"
            elif has_followup_messages:
                session_kind = "followup"
        return {
            **payload,
            "title_source": _normalize_title_source(payload.get("title_source")),
            "analysis_fingerprint": _coerce_json_text(payload.get("analysis_fingerprint")),
            "session_kind": session_kind,
            "has_summary_pack": has_summary_pack,
            "has_followup_messages": has_followup_messages,
        }

    @staticmethod
    def _build_summary_payload(record: AgentSession, history_id_by_scope: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        snapshot = record.snapshot if isinstance(record.snapshot, dict) else {}
        meta = _extract_snapshot_meta(snapshot)
        session_kind, has_summary_pack, has_followup_messages = _extract_snapshot_session_flags(snapshot)
        return AgentSessionRepo._resolve_summary_flags({
            "id": str(record.id or ""),
            "title": str(record.title or ""),
            "preview": str(record.preview or ""),
            "status": str(record.status or "idle"),
            "analysis_fingerprint": AgentSessionRepo._resolve_analysis_fingerprint(
                meta.get("analysis_fingerprint"),
                snapshot,
                history_id_by_scope,
            ),
            "is_pinned": bool(record.is_pinned),
            "title_source": _normalize_title_source(meta.get("title_source")),
            "session_kind": session_kind,
            "has_summary_pack": has_summary_pack,
            "has_followup_messages": has_followup_messages,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "pinned_at": record.pinned_at,
        })

    def _build_detail_payload(self, record: AgentSession, history_id_by_scope: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        payload = self._build_summary_payload(record, history_id_by_scope=history_id_by_scope)
        payload["snapshot"] = _clone_json_payload(record.snapshot if isinstance(record.snapshot, dict) else {})
        return payload

    def list_records(self) -> List[Dict[str, Any]]:
        session: Session = SessionLocal()
        try:
            rows = session.execute(
                select(
                    AgentSession.id.label("id"),
                    AgentSession.title.label("title"),
                    AgentSession.preview.label("preview"),
                    AgentSession.status.label("status"),
                    AgentSession.is_pinned.label("is_pinned"),
                    AgentSession.created_at.label("created_at"),
                    AgentSession.updated_at.label("updated_at"),
                    AgentSession.pinned_at.label("pinned_at"),
                )
                .select_from(AgentSession)
                .order_by(
                    desc(AgentSession.is_pinned),
                    desc(AgentSession.pinned_at),
                    desc(AgentSession.updated_at),
                    desc(AgentSession.created_at),
                )
            ).mappings().all()
            session_ids = [str(row["id"] or "") for row in rows if row.get("id")]
            snapshot_rows = session.execute(
                select(
                    AgentSession.id.label("id"),
                    AgentSession.snapshot.label("snapshot"),
                )
                .select_from(AgentSession)
                .where(AgentSession.id.in_(session_ids))
            ).mappings().all() if session_ids else []
            snapshot_by_id = {
                str(row["id"] or ""): row.get("snapshot") if isinstance(row.get("snapshot"), dict) else {}
                for row in snapshot_rows
            }
            history_rows = session.execute(
                select(
                    AnalysisHistory.id.label("id"),
                    AnalysisHistory.result_polygon.label("result_polygon"),
                ).select_from(AnalysisHistory)
            ).mappings().all()
            history_id_by_scope: Dict[str, str] = {}
            for row in history_rows:
                history_id = str(row.get("id") or "").strip()
                scope_fingerprint = build_scope_fingerprint_from_polygon(row.get("result_polygon"))
                if history_id and scope_fingerprint:
                    history_id_by_scope[scope_fingerprint] = history_id
            payloads: List[Dict[str, Any]] = []
            for row in rows:
                payload = dict(row)
                snapshot = snapshot_by_id.get(str(payload.get("id") or ""), {})
                meta = _extract_snapshot_meta(snapshot)
                session_kind, has_summary_pack, has_followup_messages = _extract_snapshot_session_flags(snapshot)
                payloads.append(self._resolve_summary_flags({
                    **payload,
                    "analysis_fingerprint": self._resolve_analysis_fingerprint(
                        meta.get("analysis_fingerprint"),
                        snapshot,
                        history_id_by_scope,
                    ),
                    "title_source": meta.get("title_source"),
                    "session_kind": session_kind,
                    "has_summary_pack": has_summary_pack,
                    "has_followup_messages": has_followup_messages,
                }))
            return payloads
        finally:
            session.close()

    def get_record(self, session_id: str) -> Optional[Dict[str, Any]]:
        session: Session = SessionLocal()
        try:
            record = session.get(AgentSession, session_id)
            if record is None:
                return None
            history_rows = session.execute(
                select(
                    AnalysisHistory.id.label("id"),
                    AnalysisHistory.result_polygon.label("result_polygon"),
                ).select_from(AnalysisHistory)
            ).mappings().all()
            history_id_by_scope: Dict[str, str] = {}
            for row in history_rows:
                history_id = str(row.get("id") or "").strip()
                scope_fingerprint = build_scope_fingerprint_from_polygon(row.get("result_polygon"))
                if history_id and scope_fingerprint:
                    history_id_by_scope[scope_fingerprint] = history_id
            return self._build_detail_payload(record, history_id_by_scope=history_id_by_scope)
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
