from typing import Dict, List, Literal, Optional, Union, overload

import e2b_connect
import httpcore
import httpx
from packaging.version import Version
from e2b.connection_config import (
    ConnectionConfig,
    Username,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from e2b.envd.process import process_connect, process_pb2
from e2b.envd.api import acheck_sandbox_health
from e2b.envd.rpc import authentication_header, ahandle_rpc_exception_with_health
from e2b.envd.versions import ENVD_COMMANDS_STDIN, ENVD_ENVD_CLOSE
from e2b.exceptions import SandboxException
from e2b.sandbox.commands.main import ProcessInfo
from e2b.sandbox.commands.command_handle import CommandResult
from e2b.sandbox_async.commands.command_handle import AsyncCommandHandle, Stderr, Stdout
from e2b.sandbox_async.utils import OutputHandler


class Commands:
    """
    Module for executing commands in the sandbox.
    """

    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        pool: httpcore.AsyncConnectionPool,
        envd_version: Version,
        envd_api: httpx.AsyncClient,
    ) -> None:
        self._connection_config = connection_config
        self._envd_version = envd_version
        self._check_health = lambda: acheck_sandbox_health(envd_api)
        self._rpc = process_connect.ProcessClient(
            envd_api_url,
            # TODO: Fix and enable compression again — the headers compression is not solved for streaming.
            # compressor=e2b_connect.GzipCompressor,
            async_pool=pool,
            json=True,
            headers=connection_config.sandbox_headers,
        )

    async def list(
        self,
        request_timeout: Optional[float] = None,
    ) -> List[ProcessInfo]:
        """
        Lists all running commands and PTY sessions.

        :param request_timeout: Timeout for the request in **seconds**

        :return: List of running commands and PTY sessions
        """
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
                    tag=p.tag if p.HasField("tag") else None,
                    cmd=p.config.cmd,
                    args=list(p.config.args),
                    envs=dict(p.config.envs),
                    cwd=p.config.cwd if p.config.HasField("cwd") else None,
                )
                for p in res.processes
            ]
        except Exception as e:
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    async def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
    ) -> bool:
        """
        Kill a running command specified by its process ID.
        It uses `SIGKILL` signal to kill the command.

        :param pid: Process ID of the command. You can get the list of processes using `sandbox.commands.list()`
        :param request_timeout: Timeout for the request in **seconds**

        :return: `True` if the command was killed, `False` if the command was not found
        """
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
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    async def send_stdin(
        self,
        pid: int,
        data: Union[str, bytes],
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Send data to command stdin.

        :param pid Process ID of the command. You can get the list of processes using `sandbox.commands.list()`.
        :param data: Data to send to the command
        :param request_timeout: Timeout for the request in **seconds**
        """
        try:
            await self._rpc.asend_input(
                process_pb2.SendInputRequest(
                    process=process_pb2.ProcessSelector(pid=pid),
                    input=process_pb2.ProcessInput(
                        stdin=data.encode() if isinstance(data, str) else data,
                    ),
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
            )
        except Exception as e:
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    async def close_stdin(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Close the command stdin.

        This signals EOF to the command. The command must have been started with `stdin=True`.

        :param pid Process ID of the command. You can get the list of processes using `sandbox.commands.list()`.
        :param request_timeout: Timeout for the request in **seconds**
        """
        if self._envd_version < ENVD_ENVD_CLOSE:
            raise SandboxException(
                f"Sandbox envd version {self._envd_version} doesn't support closing stdin. "
                f"Please rebuild your template to pick up the latest sandbox version."
            )

        try:
            await self._rpc.aclose_stdin(
                process_pb2.CloseStdinRequest(
                    process=process_pb2.ProcessSelector(pid=pid),
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
            )
        except Exception as e:
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    @overload
    async def run(
        self,
        cmd: str,
        background: Union[Literal[False], None] = None,
        tag: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[Username] = None,
        cwd: Optional[str] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
        stdin: Optional[bool] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> CommandResult:
        """
        Start a new command and wait until it finishes executing.

        :param cmd: Command to execute
        :param background: **`False` if the command should be executed in the foreground**, `True` if the command should be executed in the background
        :param tag: Custom tag used for reconnecting to the command later
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param on_stdout: Callback for command stdout output
        :param on_stderr: Callback for command stderr output
        :param stdin: If `True`, the command will have a stdin stream that you can send data to using `sandbox.commands.send_stdin()`
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param request_timeout: Timeout for the request in **seconds**

        :return: `CommandResult` result of the command execution
        """
        ...

    @overload
    async def run(
        self,
        cmd: str,
        background: Literal[True],
        tag: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[Username] = None,
        cwd: Optional[str] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
        stdin: Optional[bool] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> AsyncCommandHandle:
        """
        Start a new command and return a handle to interact with it.

        :param cmd: Command to execute
        :param background: `False` if the command should be executed in the foreground, **`True` if the command should be executed in the background**
        :param tag: Custom tag used for reconnecting to the command later
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param on_stdout: Callback for command stdout output
        :param on_stderr: Callback for command stderr output
        :param stdin: If `True`, the command will have a stdin stream that you can send data to using `sandbox.commands.send_stdin()`
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param request_timeout: Timeout for the request in **seconds**

        :return: `AsyncCommandHandle` handle to interact with the running command
        """
        ...

    async def run(
        self,
        cmd: str,
        background: Union[bool, None] = None,
        tag: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Optional[Username] = None,
        cwd: Optional[str] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
        stdin: Optional[bool] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ):
        # Check version for stdin support
        if stdin is False and self._envd_version < ENVD_COMMANDS_STDIN:
            raise SandboxException(
                f"Sandbox envd version {self._envd_version} can't specify stdin, it's always turned on. "
                f"Please rebuild your template if you need this feature."
            )

        # Default to `False`
        stdin = stdin or False

        proc = await self._start(
            cmd,
            tag,
            envs,
            user,
            cwd,
            stdin,
            timeout,
            request_timeout,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
        )

        return proc if background else await proc.wait()

    async def _start(
        self,
        cmd: str,
        tag: Optional[str],
        envs: Optional[Dict[str, str]],
        user: Optional[Username],
        cwd: Optional[str],
        stdin: bool,
        timeout: Optional[float],
        request_timeout: Optional[float],
        on_stdout: Optional[OutputHandler[Stdout]],
        on_stderr: Optional[OutputHandler[Stderr]],
    ) -> AsyncCommandHandle:
        events = self._rpc.astart(
            process_pb2.StartRequest(
                process=process_pb2.ProcessConfig(
                    cmd="/bin/bash",
                    envs=envs,
                    args=["-l", "-c", cmd],
                    cwd=cwd,
                ),
                tag=tag,
                stdin=stdin,
            ),
            headers={
                **authentication_header(self._envd_version, user),
                KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
            },
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

            pid = start_event.event.start.pid
            return AsyncCommandHandle(
                pid=pid,
                handle_kill=lambda: self.kill(pid),
                events=events,
                on_stdout=on_stdout,
                on_stderr=on_stderr,
                handle_send_stdin=lambda data, request_timeout=None: self.send_stdin(
                    pid, data, request_timeout
                ),
                handle_close_stdin=lambda request_timeout=None: self.close_stdin(
                    pid, request_timeout
                ),
                check_health=self._check_health,
            )
        except Exception as e:
            try:
                await events.aclose()
            except Exception:
                pass
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    async def connect(
        self,
        pid: Optional[int] = None,
        tag: Optional[str] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
    ) -> AsyncCommandHandle:
        """
        Connects to a running command.
        You can use `AsyncCommandHandle.wait()` to wait for the command to finish and get execution results.

        :param pid: Process ID of the command to connect to. You can get the list of processes using `sandbox.commands.list()`
        :param tag: Custom tag of the command to connect to
        :param request_timeout: Request timeout in **seconds**
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param on_stdout: Callback for command stdout output
        :param on_stderr: Callback for command stderr output

        :return: `AsyncCommandHandle` handle to interact with the running command
        """
        if (pid is None) == (tag is None):
            raise ValueError("Exactly one of pid or tag must be provided")

        selector = (
            process_pb2.ProcessSelector(pid=pid)
            if pid is not None
            else process_pb2.ProcessSelector(tag=tag)
        )
        events = self._rpc.aconnect(
            process_pb2.ConnectRequest(
                process=selector,
            ),
            headers={
                KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
            },
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

            pid = start_event.event.start.pid
            return AsyncCommandHandle(
                pid=pid,
                handle_kill=lambda: self.kill(pid),
                events=events,
                on_stdout=on_stdout,
                on_stderr=on_stderr,
                handle_send_stdin=lambda data, request_timeout=None: self.send_stdin(
                    pid, data, request_timeout
                ),
                handle_close_stdin=lambda request_timeout=None: self.close_stdin(
                    pid, request_timeout
                ),
                check_health=self._check_health,
            )
        except Exception as e:
            try:
                await events.aclose()
            except Exception:
                pass
            raise await ahandle_rpc_exception_with_health(e, self._check_health)
