from __future__ import annotations

from .schemas import WorkingMemory


def create_working_memory() -> WorkingMemory:
    return WorkingMemory()
