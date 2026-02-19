from enum import Enum


class AWSRegistryType(str, Enum):
    AWS = "aws"

    def __str__(self) -> str:
        return str(self.value)
