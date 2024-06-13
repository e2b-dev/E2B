from e2b.envd.permissions import permissions_pb2 as _permissions_pb2
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
EVENT_TYPE_UNSPECIFIED: EventType
EVENT_TYPE_CREATE: EventType
EVENT_TYPE_WRITE: EventType
EVENT_TYPE_REMOVE: EventType
EVENT_TYPE_RENAME: EventType
EVENT_TYPE_CHMOD: EventType

class MakeDirRequest(_message.Message):
    __slots__ = ("path", "user")
    PATH_FIELD_NUMBER: _ClassVar[int]
    USER_FIELD_NUMBER: _ClassVar[int]
    path: str
    user: _permissions_pb2.User
    def __init__(self, path: _Optional[str] = ..., user: _Optional[_Union[_permissions_pb2.User, _Mapping]] = ...) -> None: ...

class MakeDirResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class RemoveRequest(_message.Message):
    __slots__ = ("path", "user")
    PATH_FIELD_NUMBER: _ClassVar[int]
    USER_FIELD_NUMBER: _ClassVar[int]
    path: str
    user: _permissions_pb2.User
    def __init__(self, path: _Optional[str] = ..., user: _Optional[_Union[_permissions_pb2.User, _Mapping]] = ...) -> None: ...

class RemoveResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class StatRequest(_message.Message):
    __slots__ = ("path", "user")
    PATH_FIELD_NUMBER: _ClassVar[int]
    USER_FIELD_NUMBER: _ClassVar[int]
    path: str
    user: _permissions_pb2.User
    def __init__(self, path: _Optional[str] = ..., user: _Optional[_Union[_permissions_pb2.User, _Mapping]] = ...) -> None: ...

class StatResponse(_message.Message):
    __slots__ = ("entry",)
    ENTRY_FIELD_NUMBER: _ClassVar[int]
    entry: EntryInfo
    def __init__(self, entry: _Optional[_Union[EntryInfo, _Mapping]] = ...) -> None: ...

class EntryInfo(_message.Message):
    __slots__ = ("name", "type")
    NAME_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    name: str
    type: FileType
    def __init__(self, name: _Optional[str] = ..., type: _Optional[_Union[FileType, str]] = ...) -> None: ...

class ListDirRequest(_message.Message):
    __slots__ = ("path", "user")
    PATH_FIELD_NUMBER: _ClassVar[int]
    USER_FIELD_NUMBER: _ClassVar[int]
    path: str
    user: _permissions_pb2.User
    def __init__(self, path: _Optional[str] = ..., user: _Optional[_Union[_permissions_pb2.User, _Mapping]] = ...) -> None: ...

class ListDirResponse(_message.Message):
    __slots__ = ("entries",)
    ENTRIES_FIELD_NUMBER: _ClassVar[int]
    entries: _containers.RepeatedCompositeFieldContainer[EntryInfo]
    def __init__(self, entries: _Optional[_Iterable[_Union[EntryInfo, _Mapping]]] = ...) -> None: ...

class WatchDirRequest(_message.Message):
    __slots__ = ("path", "user")
    PATH_FIELD_NUMBER: _ClassVar[int]
    USER_FIELD_NUMBER: _ClassVar[int]
    path: str
    user: _permissions_pb2.User
    def __init__(self, path: _Optional[str] = ..., user: _Optional[_Union[_permissions_pb2.User, _Mapping]] = ...) -> None: ...

class WatchDirResponse(_message.Message):
    __slots__ = ("start", "filesystem")
    class StartEvent(_message.Message):
        __slots__ = ()
        def __init__(self) -> None: ...
    class FilesystemEvent(_message.Message):
        __slots__ = ("name", "type")
        NAME_FIELD_NUMBER: _ClassVar[int]
        TYPE_FIELD_NUMBER: _ClassVar[int]
        name: str
        type: EventType
        def __init__(self, name: _Optional[str] = ..., type: _Optional[_Union[EventType, str]] = ...) -> None: ...
    START_FIELD_NUMBER: _ClassVar[int]
    FILESYSTEM_FIELD_NUMBER: _ClassVar[int]
    start: WatchDirResponse.StartEvent
    filesystem: WatchDirResponse.FilesystemEvent
    def __init__(self, start: _Optional[_Union[WatchDirResponse.StartEvent, _Mapping]] = ..., filesystem: _Optional[_Union[WatchDirResponse.FilesystemEvent, _Mapping]] = ...) -> None: ...
