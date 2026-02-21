from enum import Enum


class LifecycleConfigResumeOn(str, Enum):
    ANY = "any"
    OFF = "off"

    def __str__(self) -> str:
        return str(self.value)
