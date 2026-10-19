import queue
import threading
from typing import Any, Callable, Generator, Literal, Optional, Union

from protobuf import Oneof

from e2b.connection_config import KEEPALIVE_PING_INTERVAL_SEC
from e2b.envd.process import process_pb
from e2b.envd.rpc import handle_rpc_exception_with_health
from e2b.envd.utils import timeout_to_ms
from e2b.exceptions import SandboxException


class _CloseSignal:
    pass


_CLOSE = _CloseSignal()
_InputKind = Literal["stdin", "pty"]
_QueueItem = Union[str, bytes, _CloseSignal]


class CommandInputStream:
    """An ordered, long-lived input stream for a command or PTY."""

    def __init__(
        self,
        rpc: Any,
        pid: int,
        input_kind: _InputKind,
        timeout: Optional[float],
        check_health: Callable[[], Optional[bool]],
        _keepalive_interval: float = KEEPALIVE_PING_INTERVAL_SEC,
    ) -> None:
        self._rpc = rpc
        self._pid = pid
        self._input_kind = input_kind
        self._timeout = timeout
        self._check_health = check_health
        self._keepalive_interval = _keepalive_interval
        self._queue: queue.Queue[_QueueItem] = queue.Queue()
        self._lock = threading.Lock()
        self._closing = False
        self._stopped = False
        self._failure: Optional[Exception] = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def send(self, data: Union[str, bytes]) -> None:
        """Enqueue input for transmission in call order."""
        with self._lock:
            if self._failure is not None:
                raise self._failure
            if self._closing or self._stopped:
                raise SandboxException("Cannot send input after the stream is closed.")
            self._queue.put(data)

    def close(self) -> None:
        """Finish the input stream and wait for envd to acknowledge it."""
        with self._lock:
            if not self._closing:
                self._closing = True
                self._queue.put(_CLOSE)

        self._thread.join()
        if self._failure is not None:
            raise self._failure

    def __enter__(self):
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        self.close()

    def _run(self) -> None:
        try:
            self._rpc.stream_input(
                self._requests(),
                timeout_ms=timeout_to_ms(self._timeout),
            )
        except Exception as error:
            failure = handle_rpc_exception_with_health(error, self._check_health)
            with self._lock:
                self._failure = failure
                self._stopped = True
                self._discard_pending_input()
        else:
            with self._lock:
                self._stopped = True

    def _discard_pending_input(self) -> None:
        while True:
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break
        self._queue.put(_CLOSE)

    def _requests(self) -> Generator[process_pb.StreamInputRequest, None, None]:
        yield process_pb.StreamInputRequest(
            event=Oneof(
                "start",
                process_pb.StreamInputRequest.StartEvent(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", self._pid))
                ),
            )
        )

        while not self._stopped:
            try:
                data = self._queue.get(timeout=self._keepalive_interval)
            except queue.Empty:
                yield process_pb.StreamInputRequest(
                    event=Oneof("keepalive", process_pb.StreamInputRequest.KeepAlive())
                )
                continue

            if isinstance(data, _CloseSignal):
                return

            payload = data.encode() if isinstance(data, str) else data
            input_value: Oneof[Literal["stdin"], bytes] | Oneof[Literal["pty"], bytes]
            if self._input_kind == "stdin":
                input_value = Oneof("stdin", payload)
            else:
                input_value = Oneof("pty", payload)
            yield process_pb.StreamInputRequest(
                event=Oneof(
                    "data",
                    process_pb.StreamInputRequest.DataEvent(
                        input=process_pb.ProcessInput(input=input_value)
                    ),
                )
            )
