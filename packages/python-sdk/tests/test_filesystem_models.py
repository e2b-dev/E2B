import datetime
import io

from protobuf.wkt import Timestamp

from e2b.envd.filesystem import filesystem_pb
import gzip

from typing import List

import pytest

from e2b.exceptions import InvalidArgumentException, TemplateException
from e2b.sandbox.filesystem.filesystem import (
    AsyncWriteEntry,
    ChunkCheck,
    WriteEntry,
    check_stream_upload,
    aiter_chunks,
    multipart_body_is_streamed,
    to_upload_body,
    to_upload_body_async,
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


def test_map_entry_info_maps_every_known_file_type():
    def entry(file_type: filesystem_pb.FileType) -> filesystem_pb.EntryInfo:
        return filesystem_pb.EntryInfo(
            name="entry",
            type=file_type,
            path="/home/user/entry",
            size=0,
            mode=0o644,
            permissions="-rw-r--r--",
            owner="user",
            group="user",
        )

    assert map_entry_info(entry(filesystem_pb.FileType.FILE)).type is FileType.FILE
    assert map_entry_info(entry(filesystem_pb.FileType.DIRECTORY)).type is FileType.DIR
    assert (
        map_entry_info(entry(filesystem_pb.FileType.SYMLINK)).type is FileType.SYMLINK
    )


def test_map_entry_info_keeps_symlink_target_on_symlink_entries():
    entry = filesystem_pb.EntryInfo(
        name="link",
        type=filesystem_pb.FileType.SYMLINK,
        path="/home/user/link",
        size=0,
        mode=0o777,
        permissions="lrwxrwxrwx",
        owner="user",
        group="user",
    )
    entry.symlink_target = "/home/user/a.txt"

    info = map_entry_info(entry)

    assert info.type is FileType.SYMLINK
    assert info.symlink_target == "/home/user/a.txt"


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


def test_multipart_body_is_streamed_only_for_binary_file_like_entries():
    # The multipart upload drops its request deadline only when httpx really
    # streams the body; `_to_httpx_file` reads text file-like data into memory,
    # so those uploads must stay bounded like str/bytes ones.
    assert not multipart_body_is_streamed([{"path": "a.txt", "data": "text"}])
    assert not multipart_body_is_streamed([{"path": "a.bin", "data": b"bytes"}])
    assert not multipart_body_is_streamed(
        [{"path": "a.txt", "data": io.StringIO("text")}]
    )
    assert multipart_body_is_streamed([{"path": "a.bin", "data": io.BytesIO(b"bytes")}])
    # Any streamed entry makes the whole body streamed.
    assert multipart_body_is_streamed(
        [
            {"path": "a.txt", "data": "text"},
            {"path": "b.bin", "data": io.BytesIO(b"bytes")},
        ]
    )


def test_map_entry_info_reports_symlink_when_envd_marks_the_entry():
    # Newer envd puts the target's type in `type` and marks the link with `is_symlink`.
    def entry(file_type, is_symlink: bool):
        return filesystem_pb.EntryInfo(
            name="link",
            type=file_type,
            path="/home/user/link",
            size=0,
            mode=0o777,
            permissions="lrwxrwxrwx",
            owner="user",
            group="user",
            symlink_target="/home/user/releases/v1",
            is_symlink=is_symlink,
        )

    to_dir = map_entry_info(entry(filesystem_pb.FileType.DIRECTORY, True))
    assert to_dir.type is FileType.SYMLINK
    assert to_dir.symlink_target == "/home/user/releases/v1"
    assert (
        map_entry_info(entry(filesystem_pb.FileType.FILE, True)).type
        is FileType.SYMLINK
    )
    # Without the flag the target type stands, as for a plain directory.
    assert (
        map_entry_info(entry(filesystem_pb.FileType.DIRECTORY, False)).type
        is FileType.DIR
    )


def test_to_upload_body_streams_an_iterable_of_bytes():
    body = to_upload_body(iter([b"hel", bytearray(b"lo")]))
    assert not isinstance(body, (bytes, io.IOBase))
    assert b"".join(body) == b"hello"

    compressed = to_upload_body((c for c in [b"hel", b"lo"]), use_gzip=True)
    assert gzip.decompress(b"".join(compressed)) == b"hello"  # type: ignore[arg-type]


def test_to_upload_body_rejects_non_bytes_chunks_and_async_iterables():
    with pytest.raises(InvalidArgumentException):
        b"".join(to_upload_body(iter(["text"])))  # type: ignore[arg-type]

    async def source():
        yield b"hello"

    with pytest.raises(InvalidArgumentException, match="AsyncSandbox"):
        to_upload_body(source())
    # bytearray is a buffer, not an iterable of chunks
    with pytest.raises(InvalidArgumentException):
        to_upload_body(bytearray(b"hello"))  # type: ignore[arg-type]


async def test_to_upload_body_async_streams_sync_and_async_iterables():
    async def source():
        yield b"hel"
        yield b"lo"

    for data in (source(), iter([b"hel", b"lo"])):
        body = to_upload_body_async(data)
        assert b"".join([c async for c in body]) == b"hello"  # type: ignore[union-attr]

    compressed = to_upload_body_async(source(), use_gzip=True)
    assert gzip.decompress(b"".join([c async for c in compressed])) == b"hello"  # type: ignore[union-attr]


def test_iterable_data_refuses_multipart():
    files: List[WriteEntry] = [{"path": "a.bin", "data": iter([b"x"])}]
    in_memory: List[WriteEntry] = [{"path": "a.bin", "data": b"x"}]
    file_like: List[WriteEntry] = [{"path": "a.bin", "data": io.BytesIO(b"x")}]
    check_stream_upload(files, True, True, allow_async=False)
    check_stream_upload(in_memory, False, False, allow_async=False)
    check_stream_upload(file_like, False, True, allow_async=False)
    with pytest.raises(InvalidArgumentException):
        check_stream_upload(files, False, True, allow_async=True)
    with pytest.raises(TemplateException):
        check_stream_upload(files, True, False, allow_async=True)

    async def source():
        yield b"x"

    async_files: List[AsyncWriteEntry] = [{"path": "a.bin", "data": source()}]
    check_stream_upload(async_files, True, True, allow_async=True)
    with pytest.raises(InvalidArgumentException, match="AsyncSandbox"):
        check_stream_upload(async_files, True, False, allow_async=False)


async def test_async_helpers_read_sync_iterables_off_the_loop():
    import threading

    loop_thread = threading.get_ident()
    threads = []

    def source():
        threads.append(threading.get_ident())
        yield b"hel"
        threads.append(threading.get_ident())
        yield b"lo"

    assert b"".join([c async for c in aiter_chunks(source())]) == b"hello"
    assert threads and loop_thread not in threads


def test_file_like_wrappers_are_read_as_files():
    import tempfile

    from e2b.io_utils import IO_CHUNK_SIZE

    with tempfile.NamedTemporaryFile() as f:
        assert not isinstance(f, io.IOBase)
        f.write(b"x" * (IO_CHUNK_SIZE + 1))
        f.flush()
        f.seek(0)
        files: List[WriteEntry] = [{"path": "a.bin", "data": f}]
        # A file, not an iterable: multipart stays allowed.
        check_stream_upload(files, False, True, allow_async=False)
        assert multipart_body_is_streamed(files)
        chunks = list(to_upload_body(f))
        assert [len(c) for c in chunks] == [IO_CHUNK_SIZE, 1]


def test_chunk_check_records_the_validation_error():
    check = ChunkCheck()
    with pytest.raises(InvalidArgumentException) as raised:
        b"".join(to_upload_body(iter([b"ok", "text"]), check=check))  # type: ignore[arg-type]
    assert check.error is raised.value
