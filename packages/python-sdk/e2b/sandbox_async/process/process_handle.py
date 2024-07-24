import asyncio
import inspect
from typing import (
    Optional,
    Callable,
    Any,
    AsyncGenerator,
    Union,
    Tuple,
    Coroutine,
)

from e2b.envd.rpc import handle_rpc_exception
from e2b.envd.process import process_pb2
from e2b.sandbox.process.process_handle import (
    ProcessExitException,
    ProcessResult,
    Stderr,
    Stdout,
)
from e2b.sandbox_async.utilts import OutputHandler


class AsyncProcessHandle:
    @property
    def pid(self):
        return self._pid

    @property
    def stdout(self):
        return self._stdout

    @property
    def stderr(self):
        return self._stderr

    @property
    def error(self):
        if self._result is None:
            return None
        return self._result.error

    @property
    def exit_code(self):
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
    ):
        self._pid = pid
        self._handle_kill = handle_kill
        self._events = events

        self._stdout: str = ""
        self._stderr: str = ""

        self._on_stdout = on_stdout
        self._on_stderr = on_stderr

        self._result: Optional[ProcessResult] = None
        self._iteration_exception: Optional[Exception] = None

        self._wait = asyncio.create_task(self._handle_events())

    async def _iterate_events(
        self,
    ) -> AsyncGenerator[
        Union[Tuple[Stdout, None], Tuple[None, Stderr]],
        None,
    ]:
        async for event in self._events:
            if event.event.HasField("data"):
                if event.event.data.stdout:
                    out = event.event.data.stdout.decode()
                    self._stdout += out
                    yield out, None
                if event.event.data.stderr:
                    out = event.event.data.stderr.decode()
                    self._stderr += out
                    yield None, out
            if event.event.HasField("end"):
                self._result = ProcessResult(
                    stdout=self._stdout,
                    stderr=self._stderr,
                    exit_code=event.event.end.exit_code,
                    error=event.event.end.error,
                )

    async def disconnect(self) -> None:
        self._wait.cancel()
        # BUG: In Python 3.8 closing async generator can throw RuntimeError.
        # await self._events.aclose()

    async def _handle_events(self):
        try:
            async for stdout, stderr in self._iterate_events():
                if stdout is not None and self._on_stdout:
                    cb = self._on_stdout(stdout)
                    if inspect.isawaitable(cb):
                        await cb
                elif stderr is not None and self._on_stderr:
                    cb = self._on_stderr(stderr)
                    if inspect.isawaitable(cb):
                        await cb
        except StopAsyncIteration:
            pass
        except Exception as e:
            self._iteration_exception = handle_rpc_exception(e)

    async def wait(self) -> ProcessResult:
        await self._wait
        if self._iteration_exception:
            raise self._iteration_exception

        if self._result is None:
            raise Exception("Process ended without an end event")

        if self._result.exit_code != 0:
            raise ProcessExitException(
                stdout=self._stdout,
                stderr=self._stderr,
                exit_code=self._result.exit_code,
                error=self._result.error,
            )

        return self._result

    async def kill(self):
        await self._handle_kill()
