from enum import Enum


class SidecarInfoRole(str, Enum):
    PROXY = "proxy"
    SERVICE = "service"

    def __str__(self) -> str:
        return str(self.value)
