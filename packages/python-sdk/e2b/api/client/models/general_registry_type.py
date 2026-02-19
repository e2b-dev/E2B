from enum import Enum


class GeneralRegistryType(str, Enum):
    REGISTRY = "registry"

    def __str__(self) -> str:
        return str(self.value)
