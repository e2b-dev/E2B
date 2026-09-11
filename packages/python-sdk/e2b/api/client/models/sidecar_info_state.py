from enum import Enum


class SidecarInfoState(str, Enum):
    FAILED = "failed"
    RUNNING = "running"
    STARTING = "starting"
    STOPPED = "stopped"

    def __str__(self) -> str:
        return str(self.value)
