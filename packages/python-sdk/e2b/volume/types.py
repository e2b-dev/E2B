import datetime
from dataclasses import dataclass
from typing import Optional

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
    atime: datetime.datetime
    """Access time."""
    mtime: datetime.datetime
    """Modification time."""
    ctime: datetime.datetime
    """Creation time."""
    target: Optional[str] = None
    """Target path for symlinks."""


__all__ = [
    "VolumeInfo",
    "VolumeEntryStat",
    "VolumeFileType",
]
