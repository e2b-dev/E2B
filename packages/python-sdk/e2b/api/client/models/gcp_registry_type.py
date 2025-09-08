from enum import Enum


class GCPRegistryType(str, Enum):
    GCP = "gcp"

    def __str__(self) -> str:
        return str(self.value)
