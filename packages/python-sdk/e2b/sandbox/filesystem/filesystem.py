import gzip
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from io import IOBase, TextIOBase
from typing import IO, Optional, Union, TypedDict

from e2b.envd.filesystem import filesystem_pb2
from e2b.exceptions import InvalidArgumentException


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
) -> bytes:
    """Prepare file data for upload, optionally gzip-compressed."""
    if isinstance(data, str):
        raw = data.encode("utf-8")
    elif isinstance(data, bytes):
        raw = data
    elif isinstance(data, TextIOBase):
        raw = data.read().encode("utf-8")
    elif isinstance(data, IOBase):
        raw = data.read()
    else:
        raise InvalidArgumentException(f"Unsupported data type: {type(data)}")

    return gzip.compress(raw) if use_gzip else raw
