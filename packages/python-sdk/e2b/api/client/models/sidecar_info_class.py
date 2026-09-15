from enum import Enum


class SidecarInfoClass(str, Enum):
    EPHEMERAL = "ephemeral"
    STATEFUL = "stateful"

    def __str__(self) -> str:
        return str(self.value)
