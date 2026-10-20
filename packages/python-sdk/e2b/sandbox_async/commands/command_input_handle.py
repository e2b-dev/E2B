import asyncio
from typing import Any, AsyncGenerator, Awaitable, Callable, Optional, Union

from protobuf import Oneof

from e2b.connection_config import KEEPALIVE_PING_INTERVAL_SEC
from e2b.envd.process import process_pb
from e2b.envd.rpc import ahandle_rpc_exception_with_health
from e2b.envd.utils import timeout_to_ms
from e2b.exceptions import SandboxException
from e2b.sandbox.commands.stream_input import (
    InputKind,
    stream_input_data,
    stream_input_start,
)


class _CloseSignal:
    pass


_CLOSE = _CloseSignal()
_QueueItem = Union[str, bytes, _CloseSignal]


class AsyncCommandInputHandle:
    """An ordered, long-lived input handle for a command or PTY."""

    def __init__(
        self,
        rpc: Any,
        pid: int,
        input_kind: InputKind,
        timeout: Optional[float],
        check_health: Callable[[], Awaitable[Optional[bool]]],
        _keepalive_interval: float = KEEPALIVE_PING_INTERVAL_SEC,
    ) -> None:
        self._rpc = rpc
        self._pid = pid
        self._input_kind = input_kind
        self._timeout = timeout
        self._check_health = check_health
        self._keepalive_interval = _keepalive_interval
        self._queue: asyncio.Queue[_QueueItem] = asyncio.Queue()
        self._closing = False
        self._stopped = False
        self._failure: Optional[Exception] = None
        self._task = asyncio.create_task(self._run())

    async def send(self, data: Union[str, bytes]) -> None:
        """Queue input for ordered transmission.

        :param data: Input data to send.
        :return: ``None`` once the input has been queued.
        :raises NotFoundException: If the command or PTY does not exist.
        :raises TimeoutException: If the input stream times out.
        :raises SandboxException: If this handle is closed. Open a new one with
            ``sandbox.commands.stream_input(pid)`` or
            ``sandbox.pty.stream_input(pid)``.
        """
        if self._failure is not None:
            raise self._failure
        if self._closing or self._stopped:
            raise SandboxException(
                "Cannot send input after the input handle is closed. Open a new one "
                "with `sandbox.commands.stream_input(pid)` or "
                "`sandbox.pty.stream_input(pid)`."
            )
        self._queue.put_nowait(data)

    async def close(self) -> None:
        """Finish the input stream and wait for envd to acknowledge it.

        :return: ``None`` when envd acknowledges the end of the input stream.
        :raises NotFoundException: If the command or PTY does not exist.
        :raises TimeoutException: If the input stream times out.
        """
        if not self._closing:
            self._closing = True
            self._queue.put_nowait(_CLOSE)
        await asyncio.shield(self._task)
        if self._failure is not None:
            raise self._failure

    async def __aenter__(self) -> "AsyncCommandInputHandle":
        return self

    async def __aexit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        await self.close()

    async def _run(self) -> None:
        try:
            await self._rpc.stream_input(
                self._requests(),
                timeout_ms=timeout_to_ms(self._timeout),
            )
        except Exception as error:
            self._failure = await ahandle_rpc_exception_with_health(
                error, self._check_health
            )
            self._stopped = True
            self._discard_pending_input()
        else:
            self._stopped = True

    def _discard_pending_input(self) -> None:
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        self._queue.put_nowait(_CLOSE)

    async def _requests(self) -> AsyncGenerator[process_pb.StreamInputRequest, None]:
        yield stream_input_start(self._pid)

        while not self._stopped:
            try:
                data = await asyncio.wait_for(
                    self._queue.get(), timeout=self._keepalive_interval
                )
            except asyncio.TimeoutError:
                yield process_pb.StreamInputRequest(
                    event=Oneof("keepalive", process_pb.StreamInputRequest.KeepAlive())
                )
                continue

            if isinstance(data, _CloseSignal):
                return

            yield stream_input_data(self._input_kind, data)
