from enum import Enum


class VolumeEntryStatType(str, Enum):
    DIRECTORY = "directory"
    FILE = "file"
    SYMLINK = "symlink"
    UNKNOWN = "unknown"

    def __str__(self) -> str:
        return str(self.value)
