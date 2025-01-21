from enum import Enum


class NodeStatus(str, Enum):
    DRAINING = "draining"
    READY = "ready"

    def __str__(self) -> str:
        return str(self.value)
