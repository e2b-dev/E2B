import asyncio
import codecs
import inspect
from typing import (
    Optional,
    Callable,
    Any,
    AsyncGenerator,
    List,
    Awaitable,
    Union,
    Tuple,
    Coroutine,
)

from e2b.envd.rpc import ahandle_rpc_exception_with_health
from e2b.envd.process import process_pb2
from e2b.exceptions import SandboxException
from e2b.sandbox.commands.command_handle import (
    CommandExitException,
    CommandResult,
    Stderr,
    Stdout,
    PtyOutput,
)
from e2b.sandbox_async.utils import OutputHandler


class AsyncCommandHandle:
    """
    Command execution handle.

    It provides methods for waiting for the command to finish, retrieving stdout/stderr, and killing the command.
    """

    @property
    def pid(self):
        """
        Command process ID.
        """
        return self._pid

    @property
    def stdout(self):
        """
        Command stdout output.
        """
        return "".join(self._stdout_chunks)

    @property
    def stderr(self):
        """
        Command stderr output.
        """
        return "".join(self._stderr_chunks)

    @property
    def error(self):
        """
        Command execution error message.
        """
        if self._result is None:
            return None
        return self._result.error

    @property
    def exit_code(self):
        """
        Command execution exit code.

        `0` if the command finished successfully.

        It is `None` if the command is still running.
        """
        if self._result is None:
            return None
        return self._result.exit_code

    def __init__(
        self,
        pid: int,
        handle_kill: Callable[[], Coroutine[Any, Any, bool]],
        events: AsyncGenerator[
            Union[process_pb2.StartResponse, process_pb2.ConnectResponse], Any
        ],
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
        on_pty: Optional[OutputHandler[PtyOutput]] = None,
        handle_send_stdin: Optional[
            Callable[[Union[str, bytes], Optional[float]], Coroutine[Any, Any, None]]
        ] = None,
        handle_close_stdin: Optional[
            Callable[[Optional[float]], Coroutine[Any, Any, None]]
        ] = None,
        check_health: Optional[Callable[[], Awaitable[Optional[bool]]]] = None,
    ):
        self._pid = pid
        self._handle_kill = handle_kill
        self._handle_send_stdin = handle_send_stdin
        self._handle_close_stdin = handle_close_stdin
        self._check_health = check_health
        self._events = events

        self._stdout_chunks: List[str] = []
        self._stderr_chunks: List[str] = []

        self._stdout_decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self._stderr_decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")

        self._on_stdout = on_stdout
        self._on_stderr = on_stderr
        self._on_pty = on_pty

        self._result: Optional[CommandResult] = None
        self._iteration_exception: Optional[Exception] = None

        self._wait = asyncio.create_task(self._handle_events())

    def _flush_decoders(
        self,
    ) -> List[Union[Tuple[Stdout, None, None], Tuple[None, Stderr, None]]]:
        """
        Flush any bytes still buffered in the stream decoders.

        Incomplete trailing UTF-8 sequences are emitted as replacement
        characters, matching the per-chunk decoding behavior.
        """
        events: List[Union[Tuple[Stdout, None, None], Tuple[None, Stderr, None]]] = []
        out = self._stdout_decoder.decode(b"", final=True)
        if out:
            self._stdout_chunks.append(out)
            events.append((out, None, None))
        err = self._stderr_decoder.decode(b"", final=True)
        if err:
            self._stderr_chunks.append(err)
            events.append((None, err, None))
        return events

    async def _iterate_events(
        self,
    ) -> AsyncGenerator[
        Union[
            Tuple[Stdout, None, None],
            Tuple[None, Stderr, None],
            Tuple[None, None, PtyOutput],
        ],
        None,
    ]:
        try:
            async for event in self._events:
                if event.event.HasField("data"):
                    if event.event.data.stdout:
                        out = self._stdout_decoder.decode(event.event.data.stdout)
                        if out:
                            self._stdout_chunks.append(out)
                            yield out, None, None
                    if event.event.data.stderr:
                        out = self._stderr_decoder.decode(event.event.data.stderr)
                        if out:
                            self._stderr_chunks.append(out)
                            yield None, out, None
                    if event.event.data.pty:
                        yield None, None, event.event.data.pty
                if event.event.HasField("end"):
                    # Flush trailing decoder bytes into the accumulators and
                    # record the result before yielding the flushed chunks, so a
                    # consumer that stops iterating on the first flushed chunk
                    # still observes the exit code.
                    flushed = list(self._flush_decoders())
                    self._result = CommandResult(
                        stdout="".join(self._stdout_chunks),
                        stderr="".join(self._stderr_chunks),
                        exit_code=event.event.end.exit_code,
                        error=event.event.end.error,
                    )
                    for f in flushed:
                        yield f
        except Exception:
            # The stream raised before an end event (e.g. disconnect or RPC
            # failure). Flush any bytes still buffered in the decoders so
            # incomplete trailing sequences surface as replacement characters
            # instead of being silently dropped, then re-raise so the error is
            # still surfaced by the consumer.
            for flushed in self._flush_decoders():
                yield flushed
            raise

        # If the stream closed without an end event (e.g. disconnect or a
        # dropped connection), flush any bytes still buffered in the decoders
        # so incomplete trailing sequences surface as replacement characters
        # instead of being silently dropped.
        if self._result is None:
            for flushed in self._flush_decoders():
                yield flushed

    async def disconnect(self) -> None:
        """
        Disconnects from the command.

        The command is not killed, but SDK stops receiving events from the command.
        You can reconnect to the command using `sandbox.commands.connect` method.
        """
        self._wait.cancel()
        await asyncio.wait([self._wait])
        try:
            await self._events.aclose()
        except Exception:
            pass

    async def _handle_events(self):
        try:
            async for stdout, stderr, pty in self._iterate_events():
                if stdout is not None and self._on_stdout:
                    cb = self._on_stdout(stdout)
                    if inspect.isawaitable(cb):
                        await cb
                elif stderr is not None and self._on_stderr:
                    cb = self._on_stderr(stderr)
                    if inspect.isawaitable(cb):
                        await cb
                elif pty is not None and self._on_pty:
                    cb = self._on_pty(pty)
                    if inspect.isawaitable(cb):
                        await cb
        except StopAsyncIteration:
            pass
        except Exception as e:
            self._iteration_exception = await ahandle_rpc_exception_with_health(
                e, self._check_health
            )

    async def wait(self) -> CommandResult:
        """
        Wait for the command to finish and return the result.
        If the command exits with a non-zero exit code, it throws a `CommandExitException`.

        :return: `CommandResult` result of command execution
        """
        await self._wait
        if self._iteration_exception:
            raise self._iteration_exception

        if self._result is None:
            raise Exception("Command ended without an end event")

        if self._result.exit_code != 0:
            raise CommandExitException(
                stdout="".join(self._stdout_chunks),
                stderr="".join(self._stderr_chunks),
                exit_code=self._result.exit_code,
                error=self._result.error,
            )

        return self._result

    async def kill(self) -> bool:
        """
        Kills the command.

        It uses `SIGKILL` signal to kill the command

        :return: `True` if the command was killed successfully, `False` if the command was not found
        """
        result = await self._handle_kill()
        return result

    async def send_stdin(
        self,
        data: Union[str, bytes],
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Send data to the command stdin.

        The command must have been started with `stdin=True`.

        :param data: Data to send to the command
        :param request_timeout: Timeout for the request in **seconds**
        """
        if self._handle_send_stdin is None:
            raise SandboxException(
                "Sending stdin is not supported for this command handle."
            )
        await self._handle_send_stdin(data, request_timeout)

    async def close_stdin(self, request_timeout: Optional[float] = None) -> None:
        """
        Close the command stdin.

        This signals EOF to the command. The command must have been started with `stdin=True`.

        :param request_timeout: Timeout for the request in **seconds**
        """
        if self._handle_close_stdin is None:
            raise SandboxException(
                "Closing stdin is not supported for this command handle."
            )
        await self._handle_close_stdin(request_timeout)
