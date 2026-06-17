import gzip
import re
import weakref
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from io import IOBase, TextIOBase
from typing import IO, AsyncIterator, Dict, Iterator, Optional, Union, TypedDict

import httpx

from e2b.envd.filesystem import filesystem_pb2
from e2b.exceptions import InvalidArgumentException
from e2b.io_utils import agzip_iter, aiter_io_chunks, gzip_iter, iter_io_chunks


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
            type=payload.get("type"),
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
        modified_time=entry.modified_time.ToDatetime(),
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


class FileStreamReader(Iterator[bytes]):
    """Iterator over a streamed file download.

    Returned by ``Sandbox.files.read(format="stream")``. It owns the underlying
    HTTP response and releases its pooled connection as soon as the stream is
    fully consumed, an error is raised while reading, or the reader is closed.

    Iterate it directly (``for chunk in stream``) or, for deterministic
    cleanup when you don't read it to the end, use it as a context manager or
    call :meth:`close`::

        with sandbox.files.read(path, format="stream") as stream:
            for chunk in stream:
                ...

    As a safety net, the connection is also released when the reader is garbage
    collected, so an abandoned stream does not leak a connection indefinitely.
    """

    def __init__(self, response: httpx.Response):
        self._response = response
        self._iterator = response.iter_bytes()
        # Releases the connection on GC if the reader is abandoned without
        # being consumed or closed. Calling it explicitly (via close) runs the
        # callback once and is then a no-op, so close is idempotent.
        self._finalizer = weakref.finalize(self, response.close)

    def __iter__(self) -> Iterator[bytes]:
        return self

    def __next__(self) -> bytes:
        try:
            return next(self._iterator)
        except BaseException:
            # Covers normal end (StopIteration) and read errors alike.
            self.close()
            raise

    def close(self) -> None:
        """Release the underlying HTTP connection. Safe to call multiple times."""
        self._finalizer()

    def __enter__(self) -> "FileStreamReader":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()


class AsyncFileStreamReader(AsyncIterator[bytes]):
    """Async iterator over a streamed file download.

    Returned by ``AsyncSandbox.files.read(format="stream")``. It owns the
    underlying HTTP response and releases its pooled connection as soon as the
    stream is fully consumed, an error is raised while reading, or the reader is
    closed.

    Iterate it directly (``async for chunk in stream``) or, for deterministic
    cleanup when you don't read it to the end, use it as an async context
    manager or call :meth:`aclose`::

        async with await sandbox.files.read(path, format="stream") as stream:
            async for chunk in stream:
                ...

    Unlike the sync reader there is no garbage-collection safety net: releasing
    an async connection requires awaiting ``aclose()``, which a finalizer cannot
    do reliably. An abandoned stream holds its pooled connection until the
    client is closed, so always consume it fully, use the context manager, or
    call :meth:`aclose`.
    """

    def __init__(self, response: httpx.Response):
        self._response = response
        self._iterator = response.aiter_bytes()
        self._closed = False

    def __aiter__(self) -> AsyncIterator[bytes]:
        return self

    async def __anext__(self) -> bytes:
        try:
            return await self._iterator.__anext__()
        except BaseException:
            # Covers normal end (StopAsyncIteration) and read errors alike.
            await self.aclose()
            raise

    async def aclose(self) -> None:
        """Release the underlying HTTP connection. Safe to call multiple times."""
        if self._closed:
            return
        self._closed = True
        await self._response.aclose()

    async def __aenter__(self) -> "AsyncFileStreamReader":
        return self

    async def __aexit__(self, *exc_info) -> None:
        await self.aclose()


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
) -> Union[bytes, IO, Iterator[bytes]]:
    """Prepare file data for upload, optionally gzip-compressed.

    File-like objects are streamed in chunks instead of being buffered in
    memory.
    """
    if isinstance(data, (str, bytes)):
        raw = data.encode("utf-8") if isinstance(data, str) else data
        return gzip.compress(raw) if use_gzip else raw
    elif isinstance(data, (TextIOBase, IOBase)):
        if use_gzip:
            return gzip_iter(iter_io_chunks(data))
        if isinstance(data, TextIOBase):
            # Text-mode IO yields str chunks—encode them while streaming.
            return iter_io_chunks(data)
        # httpx streams binary file-like objects in chunks without buffering.
        return data
    else:
        raise InvalidArgumentException(f"Unsupported data type: {type(data)}")


def to_upload_body_async(
    data: Union[str, bytes, IO],
    use_gzip: bool = False,
) -> Union[bytes, AsyncIterator[bytes]]:
    """Prepare file data for upload with async httpx, optionally gzip-compressed.

    File-like objects are streamed in chunks instead of being buffered in
    memory. Async httpx requires an async iterable for streamed request bodies.
    """
    if isinstance(data, (str, bytes)):
        raw = data.encode("utf-8") if isinstance(data, str) else data
        return gzip.compress(raw) if use_gzip else raw
    elif isinstance(data, (TextIOBase, IOBase)):
        chunks = aiter_io_chunks(data)
        return agzip_iter(chunks) if use_gzip else chunks
    else:
        raise InvalidArgumentException(f"Unsupported data type: {type(data)}")


METADATA_HEADER_PREFIX = "X-Metadata-"

# Metadata keys travel as `X-Metadata-<key>` HTTP header names, so they must be
# valid header tokens (RFC 7230); values travel as header values, restricted to
# printable US-ASCII.
_METADATA_KEY_REGEX = re.compile(r"^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$")
_METADATA_VALUE_REGEX = re.compile(r"^[\x20-\x7e]*$")


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
