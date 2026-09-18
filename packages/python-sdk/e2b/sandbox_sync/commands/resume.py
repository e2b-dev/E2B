import time

from typing import Any, Callable, Generator, Iterator, Optional, Protocol, Union

from connectrpc.code import Code
from connectrpc.errors import ConnectError
from protobuf import Oneof

from e2b.connection_config import KEEPALIVE_PING_HEADER, KEEPALIVE_PING_INTERVAL_SEC
from e2b.envd.client_sync import as_stream
from e2b.envd.process import process_connect, process_pb
from e2b.envd.utils import extract_start_pid, timeout_to_ms
from e2b.exceptions import SandboxException
from e2b.sandbox.commands.resume import (
    DEFAULT_RESUME_ATTEMPTS,
    DEFAULT_RESUME_BACKOFF,
    OutputPosition,
    is_transient_stream_failure,
    output_lost_exception,
    resume_backoff,
    stream_deadline_exception,
)

ProcessEvent = Union[process_pb.StartResponse, process_pb.ConnectResponse]

ProcessEvents = Generator[ProcessEvent, Any, None]


class ProcessEventStream(Iterator[ProcessEvent], Protocol):
    """What a command handle consumes: an iterator of process events that can
    be closed to stop receiving them."""

    def close(self) -> None: ...


ConnectFromOffsets = Callable[
    [process_pb.OutputOffsets, Optional[int]],
    Generator[process_pb.ConnectResponse, Any, None],
]
"""Opens a Connect stream replaying retained output from the given offsets,
bounded by the given ``timeout_ms``."""


def connect_from_offsets(
    rpc: process_connect.ProcessClientSync, pid: int
) -> ConnectFromOffsets:
    def connect(resume_from: process_pb.OutputOffsets, timeout_ms: Optional[int]):
        return as_stream(
            rpc.connect(
                process_pb.ConnectRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                    resume_from=resume_from,
                ),
                headers={KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC)},
                timeout_ms=timeout_ms,
            )
        )

    return connect


class ResumableEvents:
    """Process event stream that survives dropped connections.

    Tracks the position in each output stream handed to the consumer and, when
    the connection drops, reconnects with it as ``resume_from``. The start event
    of a reconnected stream is consumed here; only data and end events reach the
    consumer. Streams whose start event carried no offsets (an envd without
    output retention) surface a dropped connection as before.
    """

    def __init__(
        self,
        events: ProcessEvents,
        offsets: Optional[OutputPosition],
        connect: ConnectFromOffsets,
        timeout: Optional[float],
        check_health: Optional[Callable[[], Optional[bool]]] = None,
        max_attempts: int = DEFAULT_RESUME_ATTEMPTS,
        backoff: float = DEFAULT_RESUME_BACKOFF,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self._source: ProcessEvents = events
        self._offsets = offsets
        self._position = offsets or OutputPosition()
        self._connect = connect
        self._deadline = time.monotonic() + timeout if timeout else None
        self._check_health = check_health
        self._max_attempts = max_attempts
        self._backoff = backoff
        self._sleep = sleep
        self._stopped = False

    @property
    def resumable(self) -> bool:
        return self._offsets is not None

    @property
    def consumed(self) -> OutputPosition:
        """Position in each output stream up to which events have been handed
        out."""
        return self._position

    def __iter__(self):
        return self

    def __next__(self):
        while True:
            try:
                event = next(self._source)
            except StopIteration:
                raise
            except Exception as e:
                if (
                    self._stopped
                    or not self.resumable
                    or not is_transient_stream_failure(e)
                ):
                    raise
                self._close_source()
                self._source = self._reconnect(e)
                continue

            self._position.advance(event)
            return event

    def close(self) -> None:
        """Closes the current connection and stops any further reconnect."""
        self._stopped = True
        self._close_source()

    def _close_source(self) -> None:
        try:
            self._source.close()
        except Exception:
            pass

    def _remaining(self) -> Optional[float]:
        if self._deadline is None:
            return None
        return self._deadline - time.monotonic()

    def _reconnect(self, cause: Exception) -> ProcessEvents:
        for attempt in range(self._max_attempts):
            self._sleep(resume_backoff(attempt, self._backoff))
            if self._stopped:
                raise cause

            remaining = self._remaining()
            if remaining is not None and remaining <= 0:
                raise stream_deadline_exception()

            if self._check_health is not None:
                try:
                    running = self._check_health()
                except Exception:
                    running = None
                if running is False:
                    raise cause

            events = self._connect(
                self._position.to_offsets(),
                timeout_to_ms(remaining),
            )
            try:
                start_event = next(events, None)
                if start_event is None:
                    raise SandboxException(
                        "Failed to resume process stream: it closed before a start event"
                    )
                extract_start_pid(start_event, "resume process stream")
                return events
            except Exception as e:
                try:
                    events.close()
                except Exception:
                    pass
                if self._stopped:
                    raise cause
                if is_transient_stream_failure(e):
                    cause = e
                    continue
                if isinstance(e, ConnectError) and e.code is Code.OUT_OF_RANGE:
                    raise output_lost_exception(e) from e
                raise

        raise cause
