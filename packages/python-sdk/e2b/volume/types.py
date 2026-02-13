from dataclasses import dataclass
from typing import Optional, TypedDict

# Re-export API models for convenience
from e2b.api.client.models.volume_entry_stat import VolumeEntryStat
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


class VolumeWriteInfo(TypedDict, total=False):
    """Information about a written file."""

    name: str
    """Name of the filesystem object."""
    type: Optional[VolumeFileType]
    """Type of the filesystem object."""
    path: str
    """Path to the filesystem object."""


__all__ = [
    "VolumeInfo",
    "VolumeWriteInfo",
    "VolumeEntryStat",
    "VolumeFileType",
]
