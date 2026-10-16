import asyncio
import inspect
from collections import deque
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Deque, Dict, Optional, Union

from e2b import AsyncCommandHandle, AsyncSandbox, CommandExitException, SandboxException
from e2b.connection_config import Username
from e2b.envd.versions import ENVD_ENVD_CLOSE

from .utils import (
    JsonRpcMessage,
    LineSplitter,
    encode_message,
    parse_agent_line,
    restrict_client_capabilities,
)

STDERR_TAIL_CHARS = 4096
READ_QUEUE_MESSAGES = 64

StderrHandler = Union[Callable[[str], None], Callable[[str], Awaitable[None]]]


@dataclass
class AcpAgentExit:
    """
    Exit status of an ACP agent process.
    """

    exit_code: int
    """
    Exit code of the agent process.
    """
    error: Optional[str] = None
    """
    Error message if the process failed.
    """


class AcpTransport:
    """
    ACP over the stdin/stdout of an agent process in the sandbox.

    It implements the transport interface of the `agent-client-protocol`
    package (`send`, `receive`, `close`).
    """

    def __init__(
        self,
        sandbox: AsyncSandbox,
        max_message_bytes: int,
        on_stderr: Optional[StderrHandler],
    ):
        self._commands = sandbox.commands
        self._lines = LineSplitter(max_message_bytes)
        self._on_stderr = on_stderr
        self._stderr_tail = ""

        # Messages for the client. receive() and the reader hand them over
        # through the deque, so a cancelled receive() never loses one.
        self._pending: Deque[Any] = deque()
        self._readable = asyncio.Event()
        self._space = asyncio.Event()
        self._space.set()

        self._write_lock = asyncio.Lock()
        self._handle_ready: asyncio.Future[AsyncCommandHandle] = (
            asyncio.get_running_loop().create_future()
        )
        self._handle: Optional[AsyncCommandHandle] = None
        self._exit_task: Optional[asyncio.Task[Optional[AcpAgentExit]]] = None

        self._ended = False
        self._error: Optional[BaseException] = None
        # Set only once the process exit status is known.
        self._exit: Optional[AcpAgentExit] = None
        # Set by close(): the exit that follows is expected, and output after
        # it is not delivered.
        self._closing = False

    @property
    def pid(self) -> int:
        assert self._handle is not None
        return self._handle.pid

    async def send(self, message: JsonRpcMessage) -> None:
        await self._write(restrict_client_capabilities(message))

    async def receive(self) -> Optional[JsonRpcMessage]:
        while True:
            if self._pending:
                message = self._pending.popleft()
                if len(self._pending) < READ_QUEUE_MESSAGES:
                    self._space.set()
                return message
            if self._ended:
                if self._error is not None:
                    raise self._error
                return None
            self._readable.clear()
            await self._readable.wait()

    async def close(self, timeout: float = 5) -> None:
        # Only a known exit status means the process is gone. A failed output
        # stream can leave it running.
        if self._exit is not None or self._exit_task is None:
            return

        self._closing = True
        # Unblock the reader if it waits for the client.
        self._space.set()

        try:
            exit = await asyncio.wait_for(self._stop_and_wait(), timeout)
        except Exception:
            exit = None
        if exit is None and self._exit is None:
            await self.kill()

    async def kill(self) -> bool:
        assert self._handle is not None
        return await self._handle.kill()

    async def wait(self) -> AcpAgentExit:
        assert self._exit_task is not None
        exit = await asyncio.shield(self._exit_task)
        if exit is None:
            assert self._error is not None
            raise self._error
        return exit

    async def start(
        self,
        cmd: str,
        envs: Optional[Dict[str, str]],
        user: Optional[Username],
        cwd: Optional[str],
        request_timeout: Optional[float],
    ) -> None:
        try:
            handle = await self._commands._start(
                cmd,
                envs=envs,
                user=user,
                cwd=cwd,
                stdin=True,
                timeout=0,
                request_timeout=request_timeout,
                on_stdout=self._handle_stdout,
                on_stderr=self._handle_stderr,
                retain_output=False,
            )
        except BaseException:
            self._handle_ready.cancel()
            raise
        self._handle = handle
        self._handle_ready.set_result(handle)
        self._exit_task = asyncio.create_task(self._watch_exit(handle))

    async def _close_quietly(self) -> None:
        # The stream already failed with the real error.
        try:
            await self.close()
        except Exception:
            pass

    async def _stop_and_wait(self) -> Optional[AcpAgentExit]:
        await self._end_input()
        assert self._exit_task is not None
        return await asyncio.shield(self._exit_task)

    async def _write(self, message: Any) -> None:
        line = encode_message(message)
        handle = await asyncio.shield(self._handle_ready)
        # Client messages, replies to the agent and EOF share one ordered
        # write path, so concurrent writes never interleave.
        async with self._write_lock:
            await handle.send_stdin(line)

    async def _end_input(self) -> None:
        handle = await asyncio.shield(self._handle_ready)
        async with self._write_lock:
            if self._commands._envd_version >= ENVD_ENVD_CLOSE:
                await handle.close_stdin()
            else:
                await handle.kill()

    def _end(self, error: Optional[BaseException] = None) -> None:
        if not self._ended:
            self._ended = True
            self._error = error
        self._readable.set()
        self._space.set()

    async def _deliver(self, line: str) -> None:
        if self._closing:
            return
        message, replies = parse_agent_line(line)
        for reply in replies:
            try:
                await self._write(reply)
            except Exception:
                pass
        if message is None:
            return
        # Stop reading agent output until the client catches up.
        while len(self._pending) >= READ_QUEUE_MESSAGES and not (
            self._closing or self._ended
        ):
            self._space.clear()
            await self._space.wait()
        if self._closing or self._ended:
            return
        self._pending.append(message)
        self._readable.set()

    async def _handle_stdout(self, data: str) -> None:
        if self._closing or self._ended:
            return
        try:
            lines = self._lines.push(data)
        except SandboxException as e:
            self._end(e)
            asyncio.ensure_future(self._close_quietly())
            return
        for line in lines:
            await self._deliver(line)

    async def _handle_stderr(self, data: str) -> None:
        self._stderr_tail = (self._stderr_tail + data)[-STDERR_TAIL_CHARS:]
        if self._on_stderr:
            result = self._on_stderr(data)
            if inspect.isawaitable(result):
                await result

    async def _watch_exit(self, handle: AsyncCommandHandle) -> Optional[AcpAgentExit]:
        try:
            result = await handle.wait()
            exit = AcpAgentExit(exit_code=result.exit_code, error=result.error)
        except CommandExitException as e:
            exit = AcpAgentExit(exit_code=e.exit_code, error=e.error)
        except Exception as e:
            # The output stream failed; the process may still be running.
            self._end(e)
            return None

        self._exit = exit
        try:
            await self._deliver(self._lines.flush())
        except SandboxException as e:
            self._end(e)
        if exit.exit_code != 0 and not self._closing:
            message = f"ACP agent exited with code {exit.exit_code}"
            if exit.error:
                message += f": {exit.error}"
            if self._stderr_tail:
                message += f"\n{self._stderr_tail}"
            self._end(SandboxException(message))
        else:
            self._end()
        return exit
