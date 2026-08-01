import datetime
from typing import Optional

from e2b.volume.client.models import VolumeEntryStat as VolumeEntryStatApi
from e2b.volume.client.types import UNSET
from e2b.volume.types import VolumeEntryStat


def _ensure_utc(dt: datetime.datetime) -> datetime.datetime:
    """Mark a timezone-naive datetime as UTC (API timestamps are UTC)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt


def convert_volume_entry_stat(api_stat: VolumeEntryStatApi) -> VolumeEntryStat:
    """Convert API VolumeEntryStat to SDK VolumeEntryStat."""
    target: Optional[str] = None
    if api_stat.target is not UNSET and api_stat.target is not None:
        target = str(api_stat.target)

    return VolumeEntryStat(
        name=api_stat.name,
        type=api_stat.type_,
        path=api_stat.path,
        size=api_stat.size,
        mode=api_stat.mode,
        uid=api_stat.uid,
        gid=api_stat.gid,
        atime=_ensure_utc(api_stat.atime),
        mtime=_ensure_utc(api_stat.mtime),
        ctime=_ensure_utc(api_stat.ctime),
        target=target,
    )


class DualMethod:
    """Descriptor enabling the same name for a static (class-level) and instance method.

    When accessed on the class (e.g. ``Volume.get_info``), the static function
    is returned.  When accessed on an instance (e.g. ``vol.get_info``), the
    instance method is returned as a bound method.
    """

    def __init__(self, static_fn, instance_fn):
        self._static_fn = static_fn
        self._instance_fn = instance_fn

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self._static_fn
        return self._instance_fn.__get__(obj, objtype)
