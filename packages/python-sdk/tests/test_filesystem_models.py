import datetime

from protobuf.wkt import Timestamp

from e2b.envd.filesystem import filesystem_pb
from e2b.sandbox.filesystem.filesystem import (
    FileType,
    WriteInfo,
    map_entry_info,
    map_file_type_str,
)
from e2b.volume.client.models import VolumeEntryStat as VolumeEntryStatApi
from e2b.volume.client.models import VolumeEntryStatType
from e2b.volume.utils import convert_volume_entry_stat


def test_write_info_from_dict_converts_type_to_enum():
    info = WriteInfo.from_dict(
        {"name": "a.txt", "type": "file", "path": "/home/user/a.txt"}
    )
    assert info.type is FileType.FILE

    info = WriteInfo.from_dict({"name": "dir", "type": "dir", "path": "/home/user/dir"})
    assert info.type is FileType.DIR


def test_write_info_from_dict_handles_missing_or_unknown_type():
    info = WriteInfo.from_dict({"name": "a.txt", "path": "/home/user/a.txt"})
    assert info.type is None

    info = WriteInfo.from_dict(
        {"name": "a.txt", "type": "symlink", "path": "/home/user/a.txt"}
    )
    assert info.type is None


def test_map_file_type_str():
    assert map_file_type_str("file") is FileType.FILE
    assert map_file_type_str("dir") is FileType.DIR
    assert map_file_type_str("unknown") is None
    assert map_file_type_str(None) is None


def test_map_entry_info_modified_time_is_timezone_aware():
    entry = filesystem_pb.EntryInfo(
        name="a.txt",
        type=filesystem_pb.FileType.FILE,
        path="/home/user/a.txt",
        size=4,
        mode=0o644,
        permissions="-rw-r--r--",
        owner="user",
        group="user",
    )
    entry.modified_time = Timestamp.from_datetime(
        datetime.datetime(2026, 1, 2, 3, 4, 5, tzinfo=datetime.timezone.utc)
    )

    info = map_entry_info(entry)

    assert info.modified_time.tzinfo == datetime.timezone.utc
    assert info.modified_time == datetime.datetime(
        2026, 1, 2, 3, 4, 5, tzinfo=datetime.timezone.utc
    )


def test_convert_volume_entry_stat_normalizes_naive_times_to_utc():
    naive = datetime.datetime(2026, 1, 2, 3, 4, 5)
    aware = datetime.datetime(2026, 1, 2, 3, 4, 5, tzinfo=datetime.timezone.utc)

    api_stat = VolumeEntryStatApi(
        name="a.txt",
        type_=VolumeEntryStatType.FILE,
        path="/a.txt",
        size=4,
        mode=0o644,
        uid=1000,
        gid=1000,
        atime=naive,
        mtime=naive,
        ctime=aware,
    )

    stat = convert_volume_entry_stat(api_stat)

    assert stat.atime == aware
    assert stat.mtime == aware
    assert stat.ctime == aware
    assert stat.atime.tzinfo == datetime.timezone.utc
    assert stat.mtime.tzinfo == datetime.timezone.utc
    assert stat.ctime.tzinfo == datetime.timezone.utc
