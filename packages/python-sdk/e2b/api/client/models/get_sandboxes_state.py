from enum import Enum


class GetSandboxesState(str, Enum):
    ALL = "all"
    PAUSED = "paused"
    RUNNING = "running"

    def __str__(self) -> str:
        return str(self.value)
