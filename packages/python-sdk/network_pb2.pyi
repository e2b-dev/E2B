import permissions_pb2 as _permissions_pb2
from google.protobuf import empty_pb2 as _empty_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class PortState(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    UNKNOWN_PortState: _ClassVar[PortState]
    OPEN: _ClassVar[PortState]
    CLOSE: _ClassVar[PortState]
UNKNOWN_PortState: PortState
OPEN: PortState
CLOSE: PortState

class ConfigurePortRequest(_message.Message):
    __slots__ = ("port", "state", "access")
    PORT_FIELD_NUMBER: _ClassVar[int]
    STATE_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    port: int
    state: PortState
    access: _permissions_pb2.AccessControl
    def __init__(self, port: _Optional[int] = ..., state: _Optional[_Union[PortState, str]] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ListPortsRequest(_message.Message):
    __slots__ = ("access",)
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    access: _permissions_pb2.AccessControl
    def __init__(self, access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ListPortsResponse(_message.Message):
    __slots__ = ("ports",)
    PORTS_FIELD_NUMBER: _ClassVar[int]
    ports: _containers.RepeatedCompositeFieldContainer[Port]
    def __init__(self, ports: _Optional[_Iterable[_Union[Port, _Mapping]]] = ...) -> None: ...

class WatchPortsRequest(_message.Message):
    __slots__ = ("ports", "access")
    PORTS_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    ports: _containers.RepeatedScalarFieldContainer[int]
    access: _permissions_pb2.AccessControl
    def __init__(self, ports: _Optional[_Iterable[int]] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class Port(_message.Message):
    __slots__ = ("port", "state")
    PORT_FIELD_NUMBER: _ClassVar[int]
    STATE_FIELD_NUMBER: _ClassVar[int]
    port: int
    state: PortState
    def __init__(self, port: _Optional[int] = ..., state: _Optional[_Union[PortState, str]] = ...) -> None: ...
