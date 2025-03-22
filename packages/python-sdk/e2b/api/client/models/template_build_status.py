from enum import Enum


class TemplateBuildStatus(str, Enum):
    BUILDING = "building"
    ERROR = "error"
    READY = "ready"
    WAITING = "waiting"

    def __str__(self) -> str:
        return str(self.value)
