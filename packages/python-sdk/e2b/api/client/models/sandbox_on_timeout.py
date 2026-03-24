from enum import Enum


class SandboxOnTimeout(str, Enum):
    KILL = "kill"
    PAUSE = "pause"

    def __str__(self) -> str:
        return str(self.value)
