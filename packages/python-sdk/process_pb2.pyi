import permissions_pb2 as _permissions_pb2
from google.protobuf import empty_pb2 as _empty_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from typing import ClassVar as _ClassVar, Iterable as _Iterable, Mapping as _Mapping, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class PTYSize(_message.Message):
    __slots__ = ("cols", "rows")
    COLS_FIELD_NUMBER: _ClassVar[int]
    ROWS_FIELD_NUMBER: _ClassVar[int]
    cols: int
    rows: int
    def __init__(self, cols: _Optional[int] = ..., rows: _Optional[int] = ...) -> None: ...

class PTY(_message.Message):
    __slots__ = ("size",)
    SIZE_FIELD_NUMBER: _ClassVar[int]
    size: PTYSize
    def __init__(self, size: _Optional[_Union[PTYSize, _Mapping]] = ...) -> None: ...

class ProcessConfig(_message.Message):
    __slots__ = ("cmd", "args", "env", "cwd")
    class EnvEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    CMD_FIELD_NUMBER: _ClassVar[int]
    ARGS_FIELD_NUMBER: _ClassVar[int]
    ENV_FIELD_NUMBER: _ClassVar[int]
    CWD_FIELD_NUMBER: _ClassVar[int]
    cmd: str
    args: _containers.RepeatedScalarFieldContainer[str]
    env: _containers.ScalarMap[str, str]
    cwd: str
    def __init__(self, cmd: _Optional[str] = ..., args: _Optional[_Iterable[str]] = ..., env: _Optional[_Mapping[str, str]] = ..., cwd: _Optional[str] = ...) -> None: ...

class ListRequest(_message.Message):
    __slots__ = ("access",)
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    access: _permissions_pb2.AccessControl
    def __init__(self, access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ListResponse(_message.Message):
    __slots__ = ("processes",)
    PROCESSES_FIELD_NUMBER: _ClassVar[int]
    processes: _containers.RepeatedCompositeFieldContainer[ProcessConfig]
    def __init__(self, processes: _Optional[_Iterable[_Union[ProcessConfig, _Mapping]]] = ...) -> None: ...

class StartProcessRequest(_message.Message):
    __slots__ = ("process", "pty", "access")
    PROCESS_FIELD_NUMBER: _ClassVar[int]
    PTY_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    process: ProcessConfig
    pty: PTY
    access: _permissions_pb2.AccessControl
    def __init__(self, process: _Optional[_Union[ProcessConfig, _Mapping]] = ..., pty: _Optional[_Union[PTY, _Mapping]] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ResizePTYRequest(_message.Message):
    __slots__ = ("pid", "size", "access")
    PID_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    pid: int
    size: PTYSize
    access: _permissions_pb2.AccessControl
    def __init__(self, pid: _Optional[int] = ..., size: _Optional[_Union[PTYSize, _Mapping]] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class StartEvent(_message.Message):
    __slots__ = ("pid",)
    PID_FIELD_NUMBER: _ClassVar[int]
    pid: int
    def __init__(self, pid: _Optional[int] = ...) -> None: ...

class DataEvent(_message.Message):
    __slots__ = ("stdout", "stderr")
    STDOUT_FIELD_NUMBER: _ClassVar[int]
    STDERR_FIELD_NUMBER: _ClassVar[int]
    stdout: bytes
    stderr: bytes
    def __init__(self, stdout: _Optional[bytes] = ..., stderr: _Optional[bytes] = ...) -> None: ...

class EndEvent(_message.Message):
    __slots__ = ("exitCode", "error")
    EXITCODE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    exitCode: int
    error: str
    def __init__(self, exitCode: _Optional[int] = ..., error: _Optional[str] = ...) -> None: ...

class ProcessEvent(_message.Message):
    __slots__ = ("start", "data", "end")
    START_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    END_FIELD_NUMBER: _ClassVar[int]
    start: StartEvent
    data: DataEvent
    end: EndEvent
    def __init__(self, start: _Optional[_Union[StartEvent, _Mapping]] = ..., data: _Optional[_Union[DataEvent, _Mapping]] = ..., end: _Optional[_Union[EndEvent, _Mapping]] = ...) -> None: ...

class KillRequest(_message.Message):
    __slots__ = ("pid", "access")
    PID_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    pid: int
    access: _permissions_pb2.AccessControl
    def __init__(self, pid: _Optional[int] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class SendInputRequest(_message.Message):
    __slots__ = ("pid", "stdin", "access")
    PID_FIELD_NUMBER: _ClassVar[int]
    STDIN_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    pid: int
    stdin: bytes
    access: _permissions_pb2.AccessControl
    def __init__(self, pid: _Optional[int] = ..., stdin: _Optional[bytes] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class ConnectRequest(_message.Message):
    __slots__ = ("pid", "access")
    PID_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    pid: int
    access: _permissions_pb2.AccessControl
    def __init__(self, pid: _Optional[int] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...

class SendInputStreamRequest(_message.Message):
    __slots__ = ("stdin", "access")
    STDIN_FIELD_NUMBER: _ClassVar[int]
    ACCESS_FIELD_NUMBER: _ClassVar[int]
    stdin: bytes
    access: _permissions_pb2.AccessControl
    def __init__(self, stdin: _Optional[bytes] = ..., access: _Optional[_Union[_permissions_pb2.AccessControl, _Mapping]] = ...) -> None: ...
