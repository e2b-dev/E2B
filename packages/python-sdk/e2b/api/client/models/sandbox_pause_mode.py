from enum import Enum


class SandboxPauseMode(str, Enum):
    FILESYSTEM = "filesystem"
    FULL = "full"

    def __str__(self) -> str:
        return str(self.value)
