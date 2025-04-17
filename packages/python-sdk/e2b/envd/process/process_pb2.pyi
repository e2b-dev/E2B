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

class Signal(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    SIGNAL_UNSPECIFIED: _ClassVar[Signal]
    SIGNAL_SIGTERM: _ClassVar[Signal]
    SIGNAL_SIGKILL: _ClassVar[Signal]

SIGNAL_UNSPECIFIED: Signal
SIGNAL_SIGTERM: Signal
SIGNAL_SIGKILL: Signal

class PTY(_message.Message):
    __slots__ = ("size",)

    class Size(_message.Message):
        __slots__ = ("cols", "rows")
        COLS_FIELD_NUMBER: _ClassVar[int]
        ROWS_FIELD_NUMBER: _ClassVar[int]
        cols: int
        rows: int
        def __init__(
            self, cols: _Optional[int] = ..., rows: _Optional[int] = ...
        ) -> None: ...
    SIZE_FIELD_NUMBER: _ClassVar[int]
    size: PTY.Size
    def __init__(self, size: _Optional[_Union[PTY.Size, _Mapping]] = ...) -> None: ...

class ProcessConfig(_message.Message):
    __slots__ = ("cmd", "args", "envs", "cwd")

    class EnvsEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(
            self, key: _Optional[str] = ..., value: _Optional[str] = ...
        ) -> None: ...
    CMD_FIELD_NUMBER: _ClassVar[int]
    ARGS_FIELD_NUMBER: _ClassVar[int]
    ENVS_FIELD_NUMBER: _ClassVar[int]
    CWD_FIELD_NUMBER: _ClassVar[int]
    cmd: str
    args: _containers.RepeatedScalarFieldContainer[str]
    envs: _containers.ScalarMap[str, str]
    cwd: str
    def __init__(
        self,
        cmd: _Optional[str] = ...,
        args: _Optional[_Iterable[str]] = ...,
        envs: _Optional[_Mapping[str, str]] = ...,
        cwd: _Optional[str] = ...,
    ) -> None: ...

class ListRequest(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ProcessInfo(_message.Message):
    __slots__ = ("config", "pid", "tag")
    CONFIG_FIELD_NUMBER: _ClassVar[int]
    PID_FIELD_NUMBER: _ClassVar[int]
    TAG_FIELD_NUMBER: _ClassVar[int]
    config: ProcessConfig
    pid: int
    tag: str
    def __init__(
        self,
        config: _Optional[_Union[ProcessConfig, _Mapping]] = ...,
        pid: _Optional[int] = ...,
        tag: _Optional[str] = ...,
    ) -> None: ...

class ListResponse(_message.Message):
    __slots__ = ("processes",)
    PROCESSES_FIELD_NUMBER: _ClassVar[int]
    processes: _containers.RepeatedCompositeFieldContainer[ProcessInfo]
    def __init__(
        self, processes: _Optional[_Iterable[_Union[ProcessInfo, _Mapping]]] = ...
    ) -> None: ...

class StartRequest(_message.Message):
    __slots__ = ("process", "pty", "tag")
    PROCESS_FIELD_NUMBER: _ClassVar[int]
    PTY_FIELD_NUMBER: _ClassVar[int]
    TAG_FIELD_NUMBER: _ClassVar[int]
    process: ProcessConfig
    pty: PTY
    tag: str
    def __init__(
        self,
        process: _Optional[_Union[ProcessConfig, _Mapping]] = ...,
        pty: _Optional[_Union[PTY, _Mapping]] = ...,
        tag: _Optional[str] = ...,
    ) -> None: ...

class UpdateRequest(_message.Message):
    __slots__ = ("process", "pty")
    PROCESS_FIELD_NUMBER: _ClassVar[int]
    PTY_FIELD_NUMBER: _ClassVar[int]
    process: ProcessSelector
    pty: PTY
    def __init__(
        self,
        process: _Optional[_Union[ProcessSelector, _Mapping]] = ...,
        pty: _Optional[_Union[PTY, _Mapping]] = ...,
    ) -> None: ...

class UpdateResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ProcessEvent(_message.Message):
    __slots__ = ("start", "data", "end", "keepalive")

    class StartEvent(_message.Message):
        __slots__ = ("pid",)
        PID_FIELD_NUMBER: _ClassVar[int]
        pid: int
        def __init__(self, pid: _Optional[int] = ...) -> None: ...

    class DataEvent(_message.Message):
        __slots__ = ("stdout", "stderr", "pty")
        STDOUT_FIELD_NUMBER: _ClassVar[int]
        STDERR_FIELD_NUMBER: _ClassVar[int]
        PTY_FIELD_NUMBER: _ClassVar[int]
        stdout: bytes
        stderr: bytes
        pty: bytes
        def __init__(
            self,
            stdout: _Optional[bytes] = ...,
            stderr: _Optional[bytes] = ...,
            pty: _Optional[bytes] = ...,
        ) -> None: ...

    class EndEvent(_message.Message):
        __slots__ = ("exit_code", "exited", "status", "error")
        EXIT_CODE_FIELD_NUMBER: _ClassVar[int]
        EXITED_FIELD_NUMBER: _ClassVar[int]
        STATUS_FIELD_NUMBER: _ClassVar[int]
        ERROR_FIELD_NUMBER: _ClassVar[int]
        exit_code: int
        exited: bool
        status: str
        error: str
        def __init__(
            self,
            exit_code: _Optional[int] = ...,
            exited: bool = ...,
            status: _Optional[str] = ...,
            error: _Optional[str] = ...,
        ) -> None: ...

    class KeepAlive(_message.Message):
        __slots__ = ()
        def __init__(self) -> None: ...
    START_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    END_FIELD_NUMBER: _ClassVar[int]
    KEEPALIVE_FIELD_NUMBER: _ClassVar[int]
    start: ProcessEvent.StartEvent
    data: ProcessEvent.DataEvent
    end: ProcessEvent.EndEvent
    keepalive: ProcessEvent.KeepAlive
    def __init__(
        self,
        start: _Optional[_Union[ProcessEvent.StartEvent, _Mapping]] = ...,
        data: _Optional[_Union[ProcessEvent.DataEvent, _Mapping]] = ...,
        end: _Optional[_Union[ProcessEvent.EndEvent, _Mapping]] = ...,
        keepalive: _Optional[_Union[ProcessEvent.KeepAlive, _Mapping]] = ...,
    ) -> None: ...

class StartResponse(_message.Message):
    __slots__ = ("event",)
    EVENT_FIELD_NUMBER: _ClassVar[int]
    event: ProcessEvent
    def __init__(
        self, event: _Optional[_Union[ProcessEvent, _Mapping]] = ...
    ) -> None: ...

class ConnectResponse(_message.Message):
    __slots__ = ("event",)
    EVENT_FIELD_NUMBER: _ClassVar[int]
    event: ProcessEvent
    def __init__(
        self, event: _Optional[_Union[ProcessEvent, _Mapping]] = ...
    ) -> None: ...

class SendInputRequest(_message.Message):
    __slots__ = ("process", "input")
    PROCESS_FIELD_NUMBER: _ClassVar[int]
    INPUT_FIELD_NUMBER: _ClassVar[int]
    process: ProcessSelector
    input: ProcessInput
    def __init__(
        self,
        process: _Optional[_Union[ProcessSelector, _Mapping]] = ...,
        input: _Optional[_Union[ProcessInput, _Mapping]] = ...,
    ) -> None: ...

class SendInputResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ProcessInput(_message.Message):
    __slots__ = ("stdin", "pty")
    STDIN_FIELD_NUMBER: _ClassVar[int]
    PTY_FIELD_NUMBER: _ClassVar[int]
    stdin: bytes
    pty: bytes
    def __init__(
        self, stdin: _Optional[bytes] = ..., pty: _Optional[bytes] = ...
    ) -> None: ...

class StreamInputRequest(_message.Message):
    __slots__ = ("start", "data", "keepalive")

    class StartEvent(_message.Message):
        __slots__ = ("process",)
        PROCESS_FIELD_NUMBER: _ClassVar[int]
        process: ProcessSelector
        def __init__(
            self, process: _Optional[_Union[ProcessSelector, _Mapping]] = ...
        ) -> None: ...

    class DataEvent(_message.Message):
        __slots__ = ("input",)
        INPUT_FIELD_NUMBER: _ClassVar[int]
        input: ProcessInput
        def __init__(
            self, input: _Optional[_Union[ProcessInput, _Mapping]] = ...
        ) -> None: ...

    class KeepAlive(_message.Message):
        __slots__ = ()
        def __init__(self) -> None: ...
    START_FIELD_NUMBER: _ClassVar[int]
    DATA_FIELD_NUMBER: _ClassVar[int]
    KEEPALIVE_FIELD_NUMBER: _ClassVar[int]
    start: StreamInputRequest.StartEvent
    data: StreamInputRequest.DataEvent
    keepalive: StreamInputRequest.KeepAlive
    def __init__(
        self,
        start: _Optional[_Union[StreamInputRequest.StartEvent, _Mapping]] = ...,
        data: _Optional[_Union[StreamInputRequest.DataEvent, _Mapping]] = ...,
        keepalive: _Optional[_Union[StreamInputRequest.KeepAlive, _Mapping]] = ...,
    ) -> None: ...

class StreamInputResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class SendSignalRequest(_message.Message):
    __slots__ = ("process", "signal")
    PROCESS_FIELD_NUMBER: _ClassVar[int]
    SIGNAL_FIELD_NUMBER: _ClassVar[int]
    process: ProcessSelector
    signal: Signal
    def __init__(
        self,
        process: _Optional[_Union[ProcessSelector, _Mapping]] = ...,
        signal: _Optional[_Union[Signal, str]] = ...,
    ) -> None: ...

class SendSignalResponse(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ConnectRequest(_message.Message):
    __slots__ = ("process",)
    PROCESS_FIELD_NUMBER: _ClassVar[int]
    process: ProcessSelector
    def __init__(
        self, process: _Optional[_Union[ProcessSelector, _Mapping]] = ...
    ) -> None: ...

class ProcessSelector(_message.Message):
    __slots__ = ("pid", "tag")
    PID_FIELD_NUMBER: _ClassVar[int]
    TAG_FIELD_NUMBER: _ClassVar[int]
    pid: int
    tag: str
    def __init__(
        self, pid: _Optional[int] = ..., tag: _Optional[str] = ...
    ) -> None: ...
