from google.protobuf import empty_pb2 as _empty_pb2
import permissions_pb2 as _permissions_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class FileType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    UNKNOWN_FileType: _ClassVar[FileType]
    FILE: _ClassVar[FileType]
    DIRECTORY: _ClassVar[FileType]
    LINK: _ClassVar[FileType]
    SYMLINK: _ClassVar[FileType]

class EventType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    UNKNOWN_EventType: _ClassVar[EventType]
    CREATE: _ClassVar[EventType]
    WRITE: _ClassVar[EventType]
    REMOVE: _ClassVar[EventType]
    RENAME: _ClassVar[EventType]
    CHMOD: _ClassVar[EventType]
UNKNOWN_FileType: FileType
FILE: FileType
DIRECTORY: FileType
LINK: FileType
SYMLINK: FileType
UNKNOWN_EventType: EventType
CREATE: EventType
WRITE: EventType
REMOVE: EventType
RENAME: EventType
CHMOD: EventType

class CreateFileRequest(_message.Message):
    __slots__ = ("path", "create_parents", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    CREATE_PARENTS_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    create_parents: bool
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., create_parents: bool = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class MakeDirRequest(_message.Message):
    __slots__ = ("path", "create_parents", "mode", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    CREATE_PARENTS_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    create_parents: bool
    mode: int
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., create_parents: bool = ..., mode: _Optional[int] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class CreateLinkRequest(_message.Message):
    __slots__ = ("source", "destination", "access")
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    DESTINATION_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    source: str
    destination: str
    access: _permissions_pb2.AccessControl
    def __init__(self, source: _Optional[str] = ..., destination: _Optional[str] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class CreateSymlinkRequest(_message.Message):
    __slots__ = ("source", "destination", "access")
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    DESTINATION_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    source: str
    destination: str
    access: _permissions_pb2.AccessControl
    def __init__(self, source: _Optional[str] = ..., destination: _Optional[str] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class CopyRequest(_message.Message):
    __slots__ = ("source", "destination", "recursive", "access")
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    DESTINATION_FIELD_NUMBER: _ClassVar[int]
    RECURSIVE_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    source: str
    destination: str
    recursive: bool
    access: _permissions_pb2.AccessControl
    def __init__(self, source: _Optional[str] = ..., destination: _Optional[str] = ..., recursive: bool = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ChmodRequest(_message.Message):
    __slots__ = ("path", "mode", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    mode: int
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., mode: _Optional[int] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ChownRequest(_message.Message):
    __slots__ = ("path", "uid", "gid", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    UID_FIELD_NUMBER: _ClassVar[int]
    GID_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    uid: int
    gid: int
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., uid: _Optional[int] = ..., gid: _Optional[int] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ReadFileRequest(_message.Message):
    __slots__ = ("path", "offset", "length", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    LENGTH_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    offset: int
    length: int
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., offset: _Optional[int] = ..., length: _Optional[int] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ReadFileResponse(_message.Message):
    __slots__ = ("data",)
    DATA_FIELD_NUMBER: _ClassVar[int]
    data: bytes
    def __init__(self, data: _Optional[bytes] = ...) -> None: ...

class StatRequest(_message.Message):
    __slots__ = ("path", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class StatResponse(_message.Message):
    __slots__ = ("entry",)
    ENTRY_FIELD_NUMBER: _ClassVar[int]
    entry: EntryInfo
    def __init__(self, entry: _Optional[_Union[EntryInfo, _Mapping]] = ...) -> None: ...

class WriteFileRequest(_message.Message):
    __slots__ = ("path", "data", "create_if_not_exists", "append", "offset", "length", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    CREATE_IF_NOT_EXISTS_FIELD_NUMBER: _ClassVar[int]
    APPEND_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    LENGTH_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    data: bytes
    create_if_not_exists: bool
    append: bool
    offset: int
    length: int
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., data: _Optional[bytes] = ..., create_if_not_exists: bool = ..., append: bool = ..., offset: _Optional[int] = ..., length: _Optional[int] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class RemoveRequest(_message.Message):
    __slots__ = ("path", "all", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    ALL_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    all: bool
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., all: bool = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class MoveRequest(_message.Message):
    __slots__ = ("source", "destination", "access")
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    DESTINATION_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    source: str
    destination: str
    access: _permissions_pb2.AccessControl
    def __init__(self, source: _Optional[str] = ..., destination: _Optional[str] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class EntryInfo(_message.Message):
    __slots__ = ("name", "type", "mode", "size", "last_modified", "owner")
    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    LAST_MODIFIED_FIELD_NUMBER: _ClassVar[int]
    OWNER_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: FileType
    mode: int
    size: int
    last_modified: int
    owner: _permissions_pb2.AccessControl
    def __init__(self, name: _Optional[str] = ..., type: _Optional[_Union[FileType, str]] = ..., mode: _Optional[int] = ..., size: _Optional[int] = ..., last_modified: _Optional[int] = ..., owner: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ReadDirRequest(_message.Message):
    __slots__ = ("path", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ReadDirResponse(_message.Message):
    __slots__ = ("entries",)
    ENTRIES_FIELD_NUMBER: _ClassVar[int]
    entries: _containers.RepeatedCompositeFieldContainer[EntryInfo]
    def __init__(self, entries: _Optional[_Iterable[_Union[EntryInfo, _Mapping]]] = ...) -> None: ...

class WatchRequest(_message.Message):
    __slots__ = ("path", "access")
    PATH_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    path: str
    access: _permissions_pb2.AccessControl
    def __init__(self, path: _Optional[str] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class FilesystemEvent(_message.Message):
    __slots__ = ("path", "type", "entry")
    PATH_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    ENTRY_FIELD_NUMBER: _ClassVar[int]
    path: str
    type: EventType
    entry: EntryInfo
    def __init__(self, path: _Optional[str] = ..., type: _Optional[_Union[EventType, str]] = ..., entry: _Optional[_Union[EntryInfo, _Mapping]] = ...) -> None: ...
