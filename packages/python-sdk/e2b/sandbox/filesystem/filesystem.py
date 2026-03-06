import gzip
import zlib
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from io import IOBase, TextIOBase
from typing import IO, Iterator, Optional, Union, TypedDict

from e2b.envd.filesystem import filesystem_pb2


class FileType(Enum):
    """
    Enum representing the type of filesystem object.
    """

    FILE = "file"
    """
    Filesystem object is a file.
    """
    DIR = "dir"
    """
    Filesystem object is a directory.
    """


def map_file_type(ft: filesystem_pb2.FileType):
    if ft == filesystem_pb2.FileType.FILE_TYPE_FILE:
        return FileType.FILE
    elif ft == filesystem_pb2.FileType.FILE_TYPE_DIRECTORY:
        return FileType.DIR


@dataclass
class WriteInfo:
    """
    Sandbox filesystem object information.
    """

    name: str
    """
    Name of the filesystem object.
    """
    type: Optional[FileType]
    """
    Type of the filesystem object.
    """
    path: str
    """
    Path to the filesystem object.
    """


@dataclass
class EntryInfo(WriteInfo):
    """
    Extended sandbox filesystem object information.
    """

    size: int
    """
    Size of the filesystem object in bytes.
    """
    mode: int
    """
    File mode and permission bits.
    """
    permissions: str
    """
    String representation of file permissions (e.g. 'rwxr-xr-x').
    """
    owner: str
    """
    Owner of the filesystem object.
    """
    group: str
    """
    Group owner of the filesystem object.
    """
    modified_time: datetime
    """
    Last modification time of the filesystem object.
    """
    symlink_target: Optional[str] = None
    """
    Target of the symlink if the filesystem object is a symlink.
    If the filesystem object is not a symlink, this field is None.
    """


class WriteEntry(TypedDict):
    """
    Contains path and data of the file to be written to the filesystem.
    """

    path: str
    data: Union[str, bytes, IO]


def to_upload_body(
    data: Union[str, bytes, IO],
    use_gzip: bool = False,
) -> Union[bytes, IOBase, Iterator[bytes]]:
    """Prepare file data for upload, optionally gzip-compressed.
    Streams IOBase data directly without buffering into memory."""
    if isinstance(data, str):
        raw = data.encode("utf-8")
        return gzip.compress(raw) if use_gzip else raw
    elif isinstance(data, bytes):
        return gzip.compress(data) if use_gzip else data
    elif isinstance(data, TextIOBase):
        raw = data.read().encode("utf-8")
        return gzip.compress(raw) if use_gzip else raw
    elif isinstance(data, IOBase):
        if use_gzip:
            return _gzip_stream(data)
        return data
    else:
        raise TypeError(f"Unsupported data type: {type(data)}")


def _gzip_stream(source: IOBase, chunk_size: int = 65536) -> Iterator[bytes]:
    """Stream-compress an IOBase through gzip without buffering the whole file."""
    compressor = zlib.compressobj(wbits=31)  # 31 = gzip format
    while True:
        chunk = source.read(chunk_size)
        if not chunk:
            break
        compressed = compressor.compress(chunk)
        if compressed:
            yield compressed
    yield compressor.flush()
