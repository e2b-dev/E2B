from envd.permissions.v1 import permissions_pb2 as _permissions_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import (
    ClassVar as _ClassVar,
    Iterable as _Iterable,
    Mapping as _Mapping,
    Optional as _Optional,
    Union as _Union,
)

DESCRIPTOR: _descriptor.FileDescriptor

class PortState(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    PORT_STATE_UNSPECIFIED: _ClassVar[PortState]
    PORT_STATE_OPEN: _ClassVar[PortState]
    PORT_STATE_CLOSED: _ClassVar[PortState]

PORT_STATE_UNSPECIFIED: PortState
PORT_STATE_OPEN: PortState
PORT_STATE_CLOSED: PortState

class ListPortsRequest(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ListPortsResponse(_message.Message):
    __slots__ = ("ports",)
    PORTS_FIELD_NUMBER: _ClassVar[int]
    ports: _containers.RepeatedCompositeFieldContainer[Port]
    def __init__(
        self, ports: _Optional[_Iterable[_Union[Port, _Mapping]]] = ...
    ) -> None: ...

class WatchPortsRequest(_message.Message):
    __slots__ = ("filter",)
    FILTER_FIELD_NUMBER: _ClassVar[int]
    filter: PortFilter
    def __init__(
        self, filter: _Optional[_Union[PortFilter, _Mapping]] = ...
    ) -> None: ...

class PortFilter(_message.Message):
    __slots__ = ("ports",)
    PORTS_FIELD_NUMBER: _ClassVar[int]
    ports: _containers.RepeatedScalarFieldContainer[int]
    def __init__(self, ports: _Optional[_Iterable[int]] = ...) -> None: ...

class WatchPortsResponse(_message.Message):
    __slots__ = ("event",)
    EVENT_FIELD_NUMBER: _ClassVar[int]
    event: Port
    def __init__(self, event: _Optional[_Union[Port, _Mapping]] = ...) -> None: ...

class Port(_message.Message):
    __slots__ = ("port", "state")
    PORT_FIELD_NUMBER: _ClassVar[int]
    STATE_FIELD_NUMBER: _ClassVar[int]
    port: int
    state: PortState
    def __init__(
        self, port: _Optional[int] = ..., state: _Optional[_Union[PortState, str]] = ...
    ) -> None: ...
