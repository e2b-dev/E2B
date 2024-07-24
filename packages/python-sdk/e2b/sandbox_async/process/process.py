import e2b_connect
import httpcore

from typing import (
    Dict,
    List,
    Optional,
    Literal,
    overload,
    Union,
)

from e2b.envd.process import process_connect, process_pb2
from e2b.connection_config import Username, ConnectionConfig
from e2b.exceptions import SandboxException
from e2b.envd.rpc import authentication_header, handle_rpc_exception
from e2b.sandbox.process.main import ProcessInfo
from e2b.sandbox.process.process_handle import ProcessResult
from e2b.sandbox_async.process.process_handle import (
    AsyncProcessHandle,
    Stdout,
    Stderr,
)
from e2b.sandbox_async.utilts import OutputHandler


class Process:
    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        pool: httpcore.AsyncConnectionPool,
    ) -> None:
        self._connection_config = connection_config
        self._rpc = process_connect.ProcessClient(
            envd_api_url,
            # TODO: Fix and enable compression again — the headers compression is not solved for streaming.
            # compressor=e2b_connect.GzipCompressor,
            async_pool=pool,
        )

    async def list(
        self,
        request_timeout: Optional[float] = None,
    ) -> List[ProcessInfo]:
        try:
            res = await self._rpc.alist(
                process_pb2.ListRequest(),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
            )
            return [
                ProcessInfo(
                    pid=p.pid,
                    tag=p.tag,
                    cmd=p.config.cmd,
                    args=list(p.config.args),
                    envs=dict(p.config.envs),
                    cwd=p.config.cwd,
                )
                for p in res.processes
            ]
        except Exception as e:
            raise handle_rpc_exception(e)

    async def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
    ) -> bool:
        try:
            await self._rpc.asend_signal(
                process_pb2.SendSignalRequest(
                    process=process_pb2.ProcessSelector(pid=pid),
                    signal=process_pb2.Signal.SIGNAL_SIGKILL,
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
            )
            return True
        except Exception as e:
            if isinstance(e, e2b_connect.ConnectException):
                if e.status == e2b_connect.Code.not_found:
                    return False
            raise handle_rpc_exception(e)

    async def send_stdin(
        self,
        pid: int,
        data: str,
        request_timeout: Optional[float] = None,
    ):
        try:
            await self._rpc.asend_input(
                process_pb2.SendInputRequest(
                    process=process_pb2.ProcessSelector(pid=pid),
                    input=process_pb2.ProcessInput(
                        stdin=data.encode(),
                    ),
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    @overload
    async def run(
        self,
        cmd: str,
        background: Union[Literal[False], None] = None,
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> ProcessResult: ...

    @overload
    async def run(
        self,
        cmd: str,
        background: Literal[True],
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> AsyncProcessHandle: ...

    async def run(
        self,
        cmd: str,
        background: Union[bool, None] = None,
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ):
        proc = await self._start(
            cmd,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
        )

        return proc if background else await proc.wait()

    async def _start(
        self,
        cmd: str,
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
    ):
        events = self._rpc.astart(
            process_pb2.StartRequest(
                process=process_pb2.ProcessConfig(
                    cmd="/bin/bash",
                    envs=envs,
                    args=["-l", "-c", cmd],
                    cwd=cwd,
                ),
            ),
            headers=authentication_header(user),
            timeout=timeout,
            request_timeout=self._connection_config.get_request_timeout(
                request_timeout
            ),
        )

        try:
            start_event = await events.__anext__()

            if not start_event.HasField("event"):
                raise SandboxException(
                    f"Failed to start process: expected start event, got {start_event}"
                )

            return AsyncProcessHandle(
                pid=start_event.event.start.pid,
                handle_kill=lambda: self.kill(start_event.event.start.pid),
                events=events,
                on_stdout=on_stdout,
                on_stderr=on_stderr,
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def connect(
        self,
        pid: int,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
    ):
        events = self._rpc.aconnect(
            process_pb2.ConnectRequest(
                process=process_pb2.ProcessSelector(pid=pid),
            ),
            timeout=timeout,
            request_timeout=self._connection_config.get_request_timeout(
                request_timeout
            ),
        )

        try:
            start_event = await events.__anext__()

            if not start_event.HasField("event"):
                raise SandboxException(
                    f"Failed to connect to process: expected start event, got {start_event}"
                )

            return AsyncProcessHandle(
                pid=start_event.event.start.pid,
                handle_kill=lambda: self.kill(start_event.event.start.pid),
                events=events,
                on_stdout=on_stdout,
                on_stderr=on_stderr,
            )
        except Exception as e:
            raise handle_rpc_exception(e)
