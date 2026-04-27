from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict, List, Optional

ROAD_SYNTAX_PROGRESS_LOCK = threading.Lock()
ROAD_SYNTAX_PROGRESS: Dict[str, Dict[str, Any]] = {}
ROAD_SYNTAX_PROGRESS_TTL_SEC = 3600


def cleanup_road_syntax_progress(now_ts: Optional[float] = None) -> None:
    now_value = float(now_ts if now_ts is not None else time.time())
    stale_ids: List[str] = []
    for run_id, item in ROAD_SYNTAX_PROGRESS.items():
        updated_at = float(item.get("updated_at") or 0.0)
        if (now_value - updated_at) > float(ROAD_SYNTAX_PROGRESS_TTL_SEC):
            stale_ids.append(run_id)
    for run_id in stale_ids:
        ROAD_SYNTAX_PROGRESS.pop(run_id, None)


def update_road_syntax_progress(
    run_id: str,
    *,
    status: str = "running",
    stage: str = "",
    message: str = "",
    step: Optional[int] = None,
    total: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    now_ts = float(time.time())
    run_key = str(run_id or "").strip()
    if not run_key:
        run_key = uuid.uuid4().hex
    with ROAD_SYNTAX_PROGRESS_LOCK:
        cleanup_road_syntax_progress(now_ts)
        existing = ROAD_SYNTAX_PROGRESS.get(run_key) or {}
        started_at = float(existing.get("started_at") or now_ts)
        try:
            step_value = int(step) if step is not None else None
        except (TypeError, ValueError):
            step_value = None
        try:
            total_value = int(total) if total is not None else None
        except (TypeError, ValueError):
            total_value = None
        payload = {
            "run_id": run_key,
            "status": str(status or "running"),
            "stage": str(stage or ""),
            "message": str(message or ""),
            "step": step_value,
            "total": total_value,
            "started_at": started_at,
            "updated_at": now_ts,
            "elapsed_sec": round(max(0.0, now_ts - started_at), 1),
            "extra": dict(extra or {}),
        }
        ROAD_SYNTAX_PROGRESS[run_key] = payload
        return dict(payload)


def get_road_syntax_progress(run_id: str) -> Optional[Dict[str, Any]]:
    run_key = str(run_id or "").strip()
    if not run_key:
        return None
    now_ts = float(time.time())
    with ROAD_SYNTAX_PROGRESS_LOCK:
        cleanup_road_syntax_progress(now_ts)
        payload = ROAD_SYNTAX_PROGRESS.get(run_key)
        if not payload:
            return None
        data = dict(payload)
        started_at = float(data.get("started_at") or now_ts)
        data["elapsed_sec"] = round(max(0.0, now_ts - started_at), 1)
        return data
