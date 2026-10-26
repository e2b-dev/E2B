from typing import Literal, Union

from protobuf import Oneof

from e2b.envd.process import process_pb

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
