from typing import Callable, Generator, Iterable, Literal, Optional, Union

from protobuf import Oneof

from e2b.envd.process import process_connect, process_pb
from e2b.envd.rpc import handle_rpc_exception_with_health
from e2b.envd.utils import timeout_to_ms
from e2b.exceptions import InvalidArgumentException

InputKind = Literal["stdin", "pty"]


def stream_input_start(pid: int) -> process_pb.StreamInputRequest:
    return process_pb.StreamInputRequest(
        event=Oneof(
            "start",
            process_pb.StreamInputRequest.StartEvent(
                process=process_pb.ProcessSelector(selector=Oneof("pid", pid))
            ),
        )
    )


def stream_input_data(
    input_kind: InputKind, data: Union[str, bytes]
) -> process_pb.StreamInputRequest:
    payload = data.encode("utf-8") if isinstance(data, str) else data
    input_value: Oneof[Literal["stdin"], bytes] | Oneof[Literal["pty"], bytes]
    if input_kind == "stdin":
        input_value = Oneof("stdin", payload)
    else:
        input_value = Oneof("pty", payload)
    return process_pb.StreamInputRequest(
        event=Oneof(
            "data",
            process_pb.StreamInputRequest.DataEvent(
                input=process_pb.ProcessInput(input=input_value)
            ),
        )
    )


def stream_input_sync(
    rpc: process_connect.ProcessClientSync,
    pid: int,
    input_kind: InputKind,
    data: Iterable[Union[str, bytes]],
    timeout: Optional[float],
    check_health: Callable[[], Optional[bool]],
) -> None:
    """Send ``data`` to the process stdin or PTY over a single input stream."""
    if isinstance(data, (str, bytes, bytearray, memoryview)):
        raise InvalidArgumentException(
            "`data` must be an iterable of str or bytes chunks, not a single "
            "chunk; wrap it in a list, e.g. `stream_input(pid, [data])`."
        )

    def requests() -> Generator[process_pb.StreamInputRequest, None, None]:
        yield stream_input_start(pid)
        for item in data:
            yield stream_input_data(input_kind, item)

    try:
        rpc.stream_input(requests(), timeout_ms=timeout_to_ms(timeout))
    except Exception as error:
        raise handle_rpc_exception_with_health(error, check_health)
