from enum import Enum


class RunningSandboxState(str, Enum):
    PAUSED = "paused"
    RUNNING = "running"

    def __str__(self) -> str:
        return str(self.value)
