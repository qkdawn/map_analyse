from __future__ import annotations

from .schemas import AgentStage


class AgentStateMachine:
    def __init__(self) -> None:
        self.stage: AgentStage = "gating"

    def move_to(self, stage: AgentStage) -> AgentStage:
        self.stage = stage
        return self.stage
