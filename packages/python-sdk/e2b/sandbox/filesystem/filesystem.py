import gzip
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
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


def map_file_type_str(value: Optional[str]) -> Optional[FileType]:
    """Map a `/files` API type string to `FileType`, `None` when unknown."""
    if value == FileType.FILE.value:
        return FileType.FILE
    elif value == FileType.DIR.value:
        return FileType.DIR
    return None


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
    User-defined metadata stored on the file as `user.e2b.*` extended
    attributes. On writes this reflects the metadata supplied on upload; on
    reads (`get_info`, `list`, `rename`) it reflects any `user.e2b.*` xattr on
    the file, including ones set out-of-band. `None` when none is set.
    """

    @classmethod
    def from_dict(cls, payload: Dict) -> "WriteInfo":
        """Build a `WriteInfo` from a `/files` upload response entry."""
        return cls(
            name=payload["name"],
            type=map_file_type_str(payload.get("type")),
            path=payload["path"],
            metadata=map_metadata(payload.get("metadata")),
        )


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


def map_entry_info(entry: filesystem_pb2.EntryInfo) -> EntryInfo:
    return EntryInfo(
        name=entry.name,
        type=map_file_type(entry.type),
        path=entry.path,
        size=entry.size,
        mode=entry.mode,
        permissions=entry.permissions,
        owner=entry.owner,
        group=entry.group,
        modified_time=entry.modified_time.ToDatetime(tzinfo=timezone.utc),
        # Optional, we can't directly access symlink_target otherwise it will be "" instead of None
        symlink_target=(
            entry.symlink_target if entry.HasField("symlink_target") else None
        ),
        metadata=map_metadata(entry.metadata),
    )


class WriteEntry(TypedDict):
    """
    Contains path and data of the file to be written to the filesystem.
    """

    path: str
    data: Union[str, bytes, IO]


def _to_httpx_file(file_path: str, file_data: Union[str, bytes, IO]):
    """Build an httpx multipart `("file", (name, data))` tuple for the upload."""
    if isinstance(file_data, (str, bytes)):
        return ("file", (file_path, file_data))
    elif isinstance(file_data, TextIOBase):
        return ("file", (file_path, file_data.read()))
    elif isinstance(file_data, IOBase):
        return ("file", (file_path, file_data))
    else:
        raise InvalidArgumentException(f"Unsupported data type for file {file_path}")


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

# Metadata keys travel as `X-Metadata-<key>` HTTP header names, so they must be
# valid header tokens (RFC 7230); values travel as header values, restricted to
# printable US-ASCII.
_METADATA_KEY_REGEX = re.compile(r"\A[A-Za-z0-9!#$%&'*+\-.^_`|~]+\Z")
_METADATA_VALUE_REGEX = re.compile(r"\A[\x20-\x7e]*\Z")


def validate_metadata(metadata: Optional[Dict[str, str]]) -> None:
    """Validate metadata keys/values before they are sent as upload headers."""
    if not metadata:
        return
    for key, value in metadata.items():
        if not _METADATA_KEY_REGEX.match(key):
            raise InvalidArgumentException(
                f"Invalid metadata key {key!r}: keys must be non-empty and use only "
                "HTTP token characters (letters, digits and !#$%&'*+-.^_`|~)."
            )
        if not _METADATA_VALUE_REGEX.match(value):
            raise InvalidArgumentException(
                f"Invalid metadata value for key {key!r}: values must be printable US-ASCII."
            )


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
