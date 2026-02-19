import datetime
from dataclasses import dataclass
from typing import Optional, TypedDict

from e2b.api.client.models.volume_entry_stat_type import VolumeEntryStatType

# Type alias for file type enum
VolumeFileType = VolumeEntryStatType


@dataclass
class VolumeInfo:
    """Information about a volume."""

    volume_id: str
    """Volume ID."""
    name: str
    """Volume name."""


@dataclass
class VolumeEntryStat:
    """Volume entry stat information."""

    name: str
    """Name of the filesystem object."""
    type: VolumeFileType
    """Type of the filesystem object."""
    path: str
    """Path to the filesystem object."""
    size: int
    """Size of the filesystem object."""
    mode: int
    """Mode of the filesystem object."""
    uid: int
    """User ID of the filesystem object."""
    gid: int
    """Group ID of the filesystem object."""
    mtime: datetime.datetime
    """Modification time."""
    ctime: datetime.datetime
    """Creation time."""
    target: Optional[str] = None
    """Target path for symlinks."""


class VolumeMetadataOptions(TypedDict, total=False):
    """Options for updating file metadata."""

    uid: Optional[int]
    """User ID of the file or directory."""
    gid: Optional[int]
    """Group ID of the file or directory."""
    mode: Optional[int]
    """Mode of the file or directory."""


class VolumeWriteOptions(VolumeMetadataOptions, total=False):
    """Options for file and directory operations."""

    force: Optional[bool]
    """For makeDir: Create parent directories if they don't exist. For writeFile: Force overwrite of an existing file."""


class VolumeRemoveOptions(TypedDict, total=False):
    """Options for remove operation."""

    recursive: Optional[bool]
    """Delete all files and directories recursively (for directories only)."""


__all__ = [
    "VolumeInfo",
    "VolumeEntryStat",
    "VolumeFileType",
    "VolumeMetadataOptions",
    "VolumeWriteOptions",
    "VolumeRemoveOptions",
]
