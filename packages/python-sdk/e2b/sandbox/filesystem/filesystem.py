import gzip
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from io import IOBase, TextIOBase
from typing import IO, Dict, Optional, Union, TypedDict

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
    metadata: Optional[Dict[str, str]] = field(default=None, kw_only=True)
    """
    User-defined metadata persisted on the file as extended attributes.
    Only populated when metadata was supplied on upload and the sandbox's
    envd supports it. `None` when no metadata is set.
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


METADATA_HEADER_PREFIX = "X-Metadata-"


def metadata_to_headers(
    metadata: Optional[Dict[str, str]],
) -> Dict[str, str]:
    """Translate user metadata into the `X-Metadata-*` upload headers envd reads."""
    if not metadata:
        return {}
    return {f"{METADATA_HEADER_PREFIX}{key}": value for key, value in metadata.items()}


def map_metadata(metadata) -> Optional[Dict[str, str]]:
    """Normalize a proto/HTTP metadata map: drop empties and return a plain dict or None."""
    if not metadata:
        return None
    return dict(metadata)
