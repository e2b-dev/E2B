from enum import Enum


class NodeStatus(str, Enum):
    CONNECTING = "connecting"
    DRAINING = "draining"
    READY = "ready"
    UNHEALTHY = "unhealthy"

    def __str__(self) -> str:
        return str(self.value)
