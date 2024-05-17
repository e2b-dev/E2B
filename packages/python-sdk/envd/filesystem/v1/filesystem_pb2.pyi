from google.protobuf import timestamp_pb2 as _timestamp_pb2
from envd.permissions.v1 import permissions_pb2 as _permissions_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class FileType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    FILE_TYPE_UNSPECIFIED: _ClassVar[FileType]
    FILE_TYPE_FILE: _ClassVar[FileType]
    FILE_TYPE_DIRECTORY: _ClassVar[FileType]
    FILE_TYPE_LINK: _ClassVar[FileType]
    FILE_TYPE_SYMLINK: _ClassVar[FileType]

class EventType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    EVENT_TYPE_UNSPECIFIED: _ClassVar[EventType]
    EVENT_TYPE_CREATE: _ClassVar[EventType]
    EVENT_TYPE_WRITE: _ClassVar[EventType]
    EVENT_TYPE_REMOVE: _ClassVar[EventType]
    EVENT_TYPE_RENAME: _ClassVar[EventType]
    EVENT_TYPE_CHMOD: _ClassVar[EventType]
FILE_TYPE_UNSPECIFIED: FileType
FILE_TYPE_FILE: FileType
FILE_TYPE_DIRECTORY: FileType
FILE_TYPE_LINK: FileType
FILE_TYPE_SYMLINK: FileType
EVENT_TYPE_UNSPECIFIED: EventType
EVENT_TYPE_CREATE: EventType
EVENT_TYPE_WRITE: EventType
EVENT_TYPE_REMOVE: EventType
EVENT_TYPE_RENAME: EventType
EVENT_TYPE_CHMOD: EventType

class CreateFileRequest(_message.Message):
    __slots__ = ("path", "create_parents", "mode", "owner")
    PATH_FIELD_NUMBER: _ClassVar[int]
    CREATE_PARENTS_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    OWNER_FIELD_NUMBER: _ClassVar[int]
    path: str
    create_parents: bool
    mode: str
    owner: _permissions_pb2.Credentials
    def __init__(self, path: _Optional[str] = ..., create_parents: bool = ..., mode: _Optional[str] = ..., owner: _Optional[_Union[_permissions_pb2.Credentials, _Mapping]] = ...) -> None: ...

class CreateFileResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CreateDirRequest(_message.Message):
    __slots__ = ("path", "create_parents", "mode", "owner")
    PATH_FIELD_NUMBER: _ClassVar[int]
    CREATE_PARENTS_FIELD_NUMBER: _ClassVar[int]
    MODE_FIELD_NUMBER: _ClassVar[int]
    OWNER_FIELD_NUMBER: _ClassVar[int]
    path: str
    create_parents: bool
    mode: str
    owner: _permissions_pb2.Credentials
    def __init__(self, path: _Optional[str] = ..., create_parents: bool = ..., mode: _Optional[str] = ..., owner: _Optional[_Union[_permissions_pb2.Credentials, _Mapping]] = ...) -> None: ...

class CreateDirResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class CopyRequest(_message.Message):
    __slots__ = ("source", "destination", "recursive", "owner")
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    DESTINATION_FIELD_NUMBER: _ClassVar[int]
    RECURSIVE_FIELD_NUMBER: _ClassVar[int]
    OWNER_FIELD_NUMBER: _ClassVar[int]
    source: str
    destination: str
    recursive: bool
    owner: _permissions_pb2.Credentials
    def __init__(self, source: _Optional[str] = ..., destination: _Optional[str] = ..., recursive: bool = ..., owner: _Optional[_Union[_permissions_pb2.Credentials, _Mapping]] = ...) -> None: ...

class CopyResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class StatRequest(_message.Message):
    __slots__ = ("path",)
    PATH_FIELD_NUMBER: _ClassVar[int]
    path: str
    def __init__(self, path: _Optional[str] = ...) -> None: ...

class StatResponse(_message.Message):
    __slots__ = ("entry",)
    ENTRY_FIELD_NUMBER: _ClassVar[int]
    entry: EntryInfo
    def __init__(self, entry: _Optional[_Union[EntryInfo, _Mapping]] = ...) -> None: ...

class RemoveRequest(_message.Message):
    __slots__ = ("path", "recursive")
    PATH_FIELD_NUMBER: _ClassVar[int]
    RECURSIVE_FIELD_NUMBER: _ClassVar[int]
    path: str
    recursive: bool
    def __init__(self, path: _Optional[str] = ..., recursive: bool = ...) -> None: ...

class RemoveResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class RenameRequest(_message.Message):
    __slots__ = ("source", "destination", "owner")
    SOURCE_FIELD_NUMBER: _ClassVar[int]
    DESTINATION_FIELD_NUMBER: _ClassVar[int]
    OWNER_FIELD_NUMBER: _ClassVar[int]
    source: str
    destination: str
    owner: _permissions_pb2.Credentials
    def __init__(self, source: _Optional[str] = ..., destination: _Optional[str] = ..., owner: _Optional[_Union[_permissions_pb2.Credentials, _Mapping]] = ...) -> None: ...

class RenameResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class EntryInfo(_message.Message):
    __slots__ = ("name", "type", "owner")
    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    OWNER_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: FileType
    owner: _permissions_pb2.Credentials
    def __init__(self, name: _Optional[str] = ..., type: _Optional[_Union[FileType, str]] = ..., owner: _Optional[_Union[_permissions_pb2.Credentials, _Mapping]] = ...) -> None: ...

class ListDirRequest(_message.Message):
    __slots__ = ("path",)
    PATH_FIELD_NUMBER: _ClassVar[int]
    path: str
    def __init__(self, path: _Optional[str] = ...) -> None: ...

class ListDirResponse(_message.Message):
    __slots__ = ("entries",)
    ENTRIES_FIELD_NUMBER: _ClassVar[int]
    entries: _containers.RepeatedCompositeFieldContainer[EntryInfo]
    def __init__(self, entries: _Optional[_Iterable[_Union[EntryInfo, _Mapping]]] = ...) -> None: ...

class WatchRequest(_message.Message):
    __slots__ = ("path",)
    PATH_FIELD_NUMBER: _ClassVar[int]
    path: str
    def __init__(self, path: _Optional[str] = ...) -> None: ...

class WatchResponse(_message.Message):
    __slots__ = ("event",)
    EVENT_FIELD_NUMBER: _ClassVar[int]
    event: FilesystemEvent
    def __init__(self, event: _Optional[_Union[FilesystemEvent, _Mapping]] = ...) -> None: ...

class FilesystemEvent(_message.Message):
    __slots__ = ("path", "type", "entry")
    PATH_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    ENTRY_FIELD_NUMBER: _ClassVar[int]
    path: str
    type: EventType
    entry: EntryInfo
    def __init__(self, path: _Optional[str] = ..., type: _Optional[_Union[EventType, str]] = ..., entry: _Optional[_Union[EntryInfo, _Mapping]] = ...) -> None: ...
