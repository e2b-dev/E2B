"""Shared pieces of the reconnect logic for process event streams.

The sync and async command modules wrap the stream returned by envd's
``start``/``connect`` so that a dropped connection is re-established with
``resume_from`` set to the position already handed to the consumer; envd then
replays what was produced in the meantime and the consumer sees an unbroken
sequence of events without duplicates."""

from dataclasses import dataclass
from typing import Optional, Union

from connectrpc.code import Code
from connectrpc.errors import ConnectError
from protobuf import Oneof

from e2b.envd.process import process_pb
from e2b.envd.rpc import is_transport_failure
from e2b.exceptions import SandboxException

DEFAULT_RESUME_ATTEMPTS = 5
"""Consecutive failed reconnect attempts after which the original error is
surfaced."""

DEFAULT_RESUME_BACKOFF = 0.25
"""Delay in seconds before the first reconnect attempt; doubles on each retry."""

MAX_RESUME_BACKOFF = 5.0


class CommandOutputLostException(SandboxException):
    """
    Raised when the connection to a command was re-established but the sandbox
    no longer retains the output produced while it was down.

    The command itself keeps running; use ``sandbox.commands.connect`` to follow
    its output from the current position.
    """


@dataclass
class OutputPosition:
    """Byte position in each output stream of a process, counted from its
    start."""

    stdout: int = 0
    stderr: int = 0
    pty: int = 0

    @classmethod
    def from_offsets(cls, offsets: process_pb.OutputOffsets) -> "OutputPosition":
        return cls(stdout=offsets.stdout, stderr=offsets.stderr, pty=offsets.pty)

    def to_offsets(self) -> process_pb.OutputOffsets:
        return process_pb.OutputOffsets(
            stdout=self.stdout, stderr=self.stderr, pty=self.pty
        )

    def advance(
        self,
        event: Union[process_pb.StartResponse, process_pb.ConnectResponse],
    ) -> None:
        """Move past the output carried by ``event``, using the offset envd
        stamped on the chunk when present."""
        oneof = event.event.event if event.event is not None else None
        match oneof:
            case Oneof(field="data", value=data):
                match data.output:
                    case Oneof(field=stream, value=chunk) if stream in (
                        "stdout",
                        "stderr",
                        "pty",
                    ):
                        start = (
                            data.offset
                            if data.has_field("offset")
                            else getattr(self, stream)
                        )
                        setattr(self, stream, start + len(chunk))


def extract_start_offsets(
    start_event: Union[process_pb.StartResponse, process_pb.ConnectResponse],
) -> Optional[OutputPosition]:
    """Position announced by a ``start`` event, or ``None`` when the sandbox's
    envd predates output retention and therefore cannot resume a dropped
    stream."""
    match start_event.event.event if start_event.event is not None else None:
        case Oneof(field="start", value=start) if start.has_field("offsets"):
            return OutputPosition.from_offsets(start.offsets)
        case _:
            return None


def is_transient_stream_failure(e: Exception) -> bool:
    """Whether an error from a process event stream is a dropped connection
    that is worth re-establishing, as opposed to a deliberate cancellation, a
    deadline, or an error envd returned on purpose."""
    if is_transport_failure(e):
        return True
    return isinstance(e, ConnectError) and e.code is Code.UNAVAILABLE


def resume_backoff(attempt: int, backoff: float) -> float:
    return min(backoff * 2**attempt, MAX_RESUME_BACKOFF)


def output_lost_exception(e: ConnectError) -> CommandOutputLostException:
    return CommandOutputLostException(
        f"{e.message}: The connection to the command was re-established, but the "
        "sandbox no longer retains the output produced while it was down. The "
        "command is still running; use 'sandbox.commands.connect' to follow its "
        "output from now on."
    )


def stream_deadline_exception() -> ConnectError:
    return ConnectError(
        Code.DEADLINE_EXCEEDED,
        "Process stream deadline exceeded while reconnecting",
    )
