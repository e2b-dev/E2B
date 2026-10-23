import asyncio
import gzip
import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from io import IOBase, TextIOBase
from typing import (
    IO,
    AsyncIterable,
    AsyncIterator,
    Dict,
    Iterable,
    Iterator,
    Optional,
    Sequence,
    TypedDict,
    TypeGuard,
    Union,
    cast,
)

import httpx

from protobuf.wkt import Timestamp

from e2b.envd.filesystem import filesystem_pb
from e2b.exceptions import InvalidArgumentException, TemplateException
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
    SYMLINK = "symlink"
    """
    Filesystem object is a symlink.
    """


def map_file_type(ft: filesystem_pb.FileType):
    if ft == filesystem_pb.FileType.FILE:
        return FileType.FILE
    elif ft == filesystem_pb.FileType.DIRECTORY:
        return FileType.DIR
    elif ft == filesystem_pb.FileType.SYMLINK:
        return FileType.SYMLINK


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


def map_entry_info(entry: filesystem_pb.EntryInfo) -> EntryInfo:
    return EntryInfo(
        name=entry.name,
        # Newer envd reports a symlink's target type in `type` and marks the
        # link itself with `is_symlink`; older envd reports SYMLINK in `type`.
        type=FileType.SYMLINK if entry.is_symlink else map_file_type(entry.type),
        path=entry.path,
        size=entry.size,
        mode=entry.mode,
        permissions=entry.permissions,
        owner=entry.owner,
        group=entry.group,
        modified_time=(entry.modified_time or Timestamp()).to_datetime(),
        # Optional scalar: unset reads as "" — presence check keeps it None
        symlink_target=(
            entry.symlink_target if entry.has_field("symlink_target") else None
        ),
        metadata=map_metadata(entry.metadata),
    )


WriteData = Union[str, bytes, IO, Iterable[bytes]]
"""Data accepted by ``Sandbox.files.write``."""

AsyncWriteData = Union[str, bytes, IO, AsyncIterable[bytes]]
"""Data accepted by ``AsyncSandbox.files.write``."""


class WriteEntry(TypedDict):
    """
    Contains path and data of the file to be written to the filesystem.

    ``data`` can be a ``str``, ``bytes``, a file-like object or an iterable of
    ``bytes`` chunks.
    """

    path: str
    data: WriteData


class AsyncWriteEntry(TypedDict):
    """
    Contains path and data of the file to be written to the filesystem by ``AsyncSandbox``.

    ``data`` can be a ``str``, ``bytes``, a file-like object or an async
    iterable of ``bytes`` chunks.
    """

    path: str
    data: AsyncWriteData


class FileStreamReader(Iterator[bytes]):
    """Iterator over a streamed file download.

    Returned by ``Sandbox.files.read(format="stream")``. It owns the underlying
    HTTP response and releases its pooled connection as soon as the stream is
    fully consumed, an error is raised while reading (including the idle-read
    timeout, which raises ``httpx.ReadTimeout``), or the reader is closed.

    There is no garbage-collection safety net, so always consume it fully, use
    it as a context manager, or call :meth:`close`::

        with sandbox.files.read(path, format="stream") as stream:
            for chunk in stream:
                ...
    """

    def __init__(self, response: httpx.Response):
        self._response = response
        self._iterator = response.iter_bytes()
        self._closed = False

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
        if self._closed:
            return
        self._closed = True
        self._response.close()

    def __enter__(self) -> "FileStreamReader":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()


class AsyncFileStreamReader(AsyncIterator[bytes]):
    """Async iterator over a streamed file download.

    Returned by ``AsyncSandbox.files.read(format="stream")``. It owns the
    underlying HTTP response and releases its pooled connection as soon as the
    stream is fully consumed, an error is raised while reading (including the
    idle-read timeout, which raises ``httpx.ReadTimeout``), or the reader is
    closed.

    There is no garbage-collection safety net (releasing an async connection
    requires awaiting ``aclose()``, which a finalizer cannot do reliably), so
    always consume it fully, use it as an async context manager, or call
    :meth:`aclose`::

        async with await sandbox.files.read(path, format="stream") as stream:
            async for chunk in stream:
                ...
    """

    def __init__(self, response: httpx.Response, idle_timeout: Optional[float] = None):
        self._response = response
        self._iterator = response.aiter_bytes()
        # An explicit per-call idle bound, applied around each read with
        # `wait_for` (the transport-wide idle read timeout covers the
        # default case; see the flavor `read` implementations).
        self._idle_timeout = idle_timeout
        self._closed = False

    def __aiter__(self) -> AsyncIterator[bytes]:
        return self

    async def __anext__(self) -> bytes:
        try:
            read = self._iterator.__anext__()
            if self._idle_timeout:
                return await asyncio.wait_for(read, self._idle_timeout)
            return await read
        except TimeoutError as e:
            # `wait_for`'s expiry; keep the documented httpx exception. The
            # transport's own idle read timeout already arrives as one.
            await self.aclose()
            raise httpx.ReadTimeout(str(e)) from e
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


def _is_file_like(data) -> TypeGuard[IO]:
    """Whether ``data`` is read as a file: an ``IOBase``, or any object with a
    ``read`` method (``tempfile`` wrappers, werkzeug ``FileStorage``, Django
    ``File``), which would otherwise be iterated line by line."""
    return isinstance(data, IOBase) or (
        not isinstance(data, (str, bytes)) and callable(getattr(data, "read", None))
    )


def _is_chunk_iterable(data) -> TypeGuard[Iterable[bytes]]:
    """Whether ``data`` is an iterable of ``bytes`` chunks (not a buffer or file)."""
    return (
        isinstance(data, Iterable)
        and not isinstance(data, (str, bytes, bytearray, memoryview))
        and not _is_file_like(data)
    )


def _is_async_chunk_iterable(data) -> TypeGuard[AsyncIterable[bytes]]:
    return isinstance(data, AsyncIterable) and not _is_file_like(data)


class ChunkCheck:
    """Records a chunk validation error raised while the transport pulls the
    upload body: the transport reports it as its own ``httpx.WriteError``, so
    the write re-raises the recorded error instead."""

    def __init__(self) -> None:
        self.error: Optional[InvalidArgumentException] = None


def _check_chunk(chunk, check: Optional[ChunkCheck] = None) -> bytes:
    if isinstance(chunk, bytes):
        return chunk
    if isinstance(chunk, (bytearray, memoryview)):
        return bytes(chunk)
    err = InvalidArgumentException(
        f"Iterable upload data must yield bytes chunks, got {type(chunk).__name__}"
    )
    if check is not None:
        check.error = err
    raise err


def iter_chunks(
    data: Iterable[bytes], check: Optional[ChunkCheck] = None
) -> Iterator[bytes]:
    """Iterate user-supplied upload chunks, rejecting anything but bytes."""
    for chunk in data:
        yield _check_chunk(chunk, check)


async def aiter_chunks(
    data: AsyncIterable[bytes], check: Optional[ChunkCheck] = None
) -> AsyncIterator[bytes]:
    """Iterate user-supplied async upload chunks, rejecting anything but bytes."""
    async for chunk in data:
        yield _check_chunk(chunk, check)


def _is_wrong_iterable(data, is_async: bool) -> bool:
    """Whether ``data`` is an iterable of the kind the other SDK takes: async
    iterables only go to ``AsyncSandbox``, sync ones only to ``Sandbox``."""
    if is_async:
        return _is_chunk_iterable(data) and not _is_async_chunk_iterable(data)
    return _is_async_chunk_iterable(data) and not _is_chunk_iterable(data)


def _unsupported_data(
    data, is_async: bool, file_path: Optional[str] = None
) -> InvalidArgumentException:
    target = f" for file {file_path}" if file_path else ""
    if _is_wrong_iterable(data, is_async):
        if is_async:
            return InvalidArgumentException(
                f"Sync iterable data{target} is only supported by `Sandbox`; "
                "pass an async iterable of bytes, a file-like object or bytes to `AsyncSandbox.files.write`."
            )
        return InvalidArgumentException(
            f"Async iterable data{target} is only supported by `AsyncSandbox`; "
            "pass a sync iterable of bytes, a file-like object or bytes to `Sandbox.files.write`."
        )
    return InvalidArgumentException(f"Unsupported data type{target}: {type(data)}")


def check_stream_upload(
    files: Sequence[Union[WriteEntry, AsyncWriteEntry]],
    use_octet_stream: bool,
    supports_octet_stream: bool,
    is_async: bool,
) -> None:
    """Reject iterable data on the multipart upload, which would buffer it.

    Iterables of the other SDK's kind are rejected outright: sync ones in
    ``AsyncSandbox`` (``is_async``), async ones in ``Sandbox``.
    """
    for file in files:
        if _is_wrong_iterable(file["data"], is_async):
            raise _unsupported_data(file["data"], is_async, file["path"])
    if not any(
        _is_chunk_iterable(file["data"]) or _is_async_chunk_iterable(file["data"])
        for file in files
    ):
        return
    if not supports_octet_stream:
        raise TemplateException("Uploading iterable data requires envd 0.5.7 or later.")
    if not use_octet_stream:
        raise InvalidArgumentException(
            "Iterable data is only uploaded with octet-stream; "
            "`use_octet_stream=False` is not supported for it."
        )


class _BinaryReader:
    """Reads a non-``IOBase`` file-like of either mode as UTF-8 bytes.

    httpx sizes a multipart file by its descriptor, which miscounts text that
    re-encodes to a different length, so this hides the descriptor and httpx
    streams the field without a precomputed length."""

    def __init__(self, data: IO) -> None:
        self._data = data

    def read(self, size: int = -1) -> bytes:
        chunk = self._data.read(size)
        return chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")


def _to_httpx_file(
    file_path: str, file_data: Union[WriteData, AsyncWriteData], is_async: bool
):
    """Build an httpx multipart `("file", (name, data))` tuple for the upload."""
    if isinstance(file_data, (str, bytes)):
        return ("file", (file_path, file_data))
    elif isinstance(file_data, TextIOBase):
        # httpx raises TypeError for text-mode objects in a multipart field, so
        # reading it here is what lets the multipart path accept one at all —
        # at the cost of buffering. The octet-stream path streams it instead,
        # which is why a file-like entry defaults to that path.
        return ("file", (file_path, file_data.read()))
    elif isinstance(file_data, IOBase):
        return ("file", (file_path, file_data))
    elif _is_file_like(file_data):
        return ("file", (file_path, cast(IO[bytes], _BinaryReader(file_data))))
    else:
        raise _unsupported_data(file_data, is_async, file_path)


def multipart_body_is_streamed(
    files: Sequence[Union[WriteEntry, AsyncWriteEntry]],
) -> bool:
    """Whether the multipart body built from ``files`` streams any entry.

    Only binary file-like data is handed to httpx as a stream:
    :func:`_to_httpx_file` reads text file-like data into memory first, because
    httpx rejects text-mode objects in a multipart field ("Multipart file
    uploads must be opened in binary mode"). Those uploads therefore stay
    bounded by the request timeout, like ``str``/``bytes`` ones. Compare
    ``to_upload_body``, which streams text and binary alike on the
    octet-stream path (``iter_io_chunks`` encodes the chunks)."""
    return any(
        _is_file_like(file["data"]) and not isinstance(file["data"], TextIOBase)
        for file in files
    )


def to_upload_body(
    data: WriteData,
    use_gzip: bool = False,
    check: Optional[ChunkCheck] = None,
) -> Union[bytes, IO, Iterator[bytes]]:
    """Prepare file data for upload, optionally gzip-compressed.

    File-like objects and iterables of bytes are streamed in chunks instead of
    being buffered in memory.
    """
    if isinstance(data, (str, bytes)):
        raw = data.encode("utf-8") if isinstance(data, str) else data
        return gzip.compress(raw) if use_gzip else raw
    elif _is_file_like(data):
        if (
            isinstance(data, IOBase)
            and not isinstance(data, TextIOBase)
            and not use_gzip
        ):
            # httpx streams binary file-like objects in chunks without buffering.
            return cast(IO, data)
        # Text-mode IO yields str chunks—encode them while streaming. Other
        # file-likes may be either mode, and httpx would iterate them by line.
        chunks = iter_io_chunks(data)
        return gzip_iter(chunks) if use_gzip else chunks
    elif _is_chunk_iterable(data):
        chunks = iter_chunks(data, check)
        return gzip_iter(chunks) if use_gzip else chunks
    else:
        raise _unsupported_data(data, is_async=False)


def to_upload_body_async(
    data: AsyncWriteData,
    use_gzip: bool = False,
    check: Optional[ChunkCheck] = None,
) -> Union[bytes, AsyncIterator[bytes]]:
    """Prepare file data for upload with async httpx, optionally gzip-compressed.

    File-like objects and async iterables of bytes are streamed in chunks
    instead of being buffered in memory. Async httpx requires an async iterable
    for streamed request bodies.
    """
    if isinstance(data, (str, bytes)):
        raw = data.encode("utf-8") if isinstance(data, str) else data
        return gzip.compress(raw) if use_gzip else raw
    elif _is_file_like(data):
        chunks = aiter_io_chunks(data)
        return agzip_iter(chunks) if use_gzip else chunks
    elif _is_async_chunk_iterable(data):
        chunks = aiter_chunks(data, check)
        return agzip_iter(chunks) if use_gzip else chunks
    else:
        raise _unsupported_data(data, is_async=True)


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
