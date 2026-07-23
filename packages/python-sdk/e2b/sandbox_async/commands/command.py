from typing import Dict, List, Literal, Optional, Union, overload

import httpx
from connectrpc.code import Code
from connectrpc.errors import ConnectError
from packaging.version import Version
from e2b.connection_config import (
    ConnectionConfig,
    Username,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from protobuf import Oneof

from e2b.envd.process import process_connect, process_pb
from e2b.envd.api import acheck_sandbox_health
from e2b.envd.rpc import (
    authentication_header,
    extract_start_pid,
    ahandle_rpc_exception_with_health,
)
from e2b.envd.utils import timeout_to_ms
from e2b.envd.client_async import as_stream, create_rpc_client, first_event
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
        envd_version: Version,
        envd_api: httpx.AsyncClient,
    ) -> None:
        self._connection_config = connection_config
        self._envd_version = envd_version
        self._check_health = lambda: acheck_sandbox_health(envd_api)
        self._rpc = create_rpc_client(
            process_connect.ProcessClient,
            envd_api_url,
            connection_config,
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
            res = await self._rpc.list(
                process_pb.ListRequest(),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
            )
            return [
                ProcessInfo(
                    pid=p.pid,
                    # Optional scalars: unset reads as "" — presence checks keep
                    # them None
                    tag=p.tag if p.has_field("tag") else None,
                    cmd=config.cmd,
                    args=list(config.args),
                    envs=dict(config.envs),
                    cwd=config.cwd if config.has_field("cwd") else None,
                )
                for p in res.processes
                for config in (p.config or process_pb.ProcessConfig(),)
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
            await self._rpc.send_signal(
                process_pb.SendSignalRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                    signal=process_pb.Signal.SIGKILL,
                ),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
            )
            return True
        except Exception as e:
            if isinstance(e, ConnectError):
                if e.code == Code.NOT_FOUND:
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
            await self._rpc.send_input(
                process_pb.SendInputRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                    input=process_pb.ProcessInput(
                        input=Oneof(
                            "stdin", data.encode() if isinstance(data, str) else data
                        ),
                    ),
                ),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
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
            await self._rpc.close_stdin(
                process_pb.CloseStdinRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                ),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
            )
        except Exception as e:
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    @overload
    async def run(
        self,
        cmd: str,
        background: Union[Literal[False], None] = None,
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
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param on_stdout: Callback for command stdout output
        :param on_stderr: Callback for command stderr output
        :param stdin: If `True`, the command will have a stdin stream that you can send data to using `sandbox.commands.send_stdin()`
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param request_timeout: Timeout for opening the stream in **seconds** — the wait until envd confirms with a start event. The running stream is bounded by `timeout`

        :return: `CommandResult` result of the command execution
        """
        ...

    @overload
    async def run(
        self,
        cmd: str,
        background: Literal[True],
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
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param on_stdout: Callback for command stdout output
        :param on_stderr: Callback for command stderr output
        :param stdin: If `True`, the command will have a stdin stream that you can send data to using `sandbox.commands.send_stdin()`
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param request_timeout: Timeout for opening the stream in **seconds** — the wait until envd confirms with a start event. The running stream is bounded by `timeout`

        :return: `AsyncCommandHandle` handle to interact with the running command
        """
        ...

    async def run(
        self,
        cmd: str,
        background: Union[bool, None] = None,
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
        envs: Optional[Dict[str, str]],
        user: Optional[Username],
        cwd: Optional[str],
        stdin: bool,
        timeout: Optional[float],
        request_timeout: Optional[float],
        on_stdout: Optional[OutputHandler[Stdout]],
        on_stderr: Optional[OutputHandler[Stderr]],
    ) -> AsyncCommandHandle:
        events = as_stream(
            self._rpc.start(
                process_pb.StartRequest(
                    process=process_pb.ProcessConfig(
                        cmd="/bin/bash",
                        envs=envs,
                        args=["-l", "-c", cmd],
                        cwd=cwd,
                    ),
                    stdin=stdin,
                ),
                headers={
                    **authentication_header(self._envd_version, user),
                    KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
                },
                # The command `timeout` bounds the whole stream;
                # `request_timeout` bounds opening it (the wait for the
                # start event below).
                timeout_ms=timeout_to_ms(timeout),
            )
        )

        try:
            start_event = await first_event(
                events, self._connection_config.get_request_timeout(request_timeout)
            )

            pid = extract_start_pid(start_event, "start process")
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
        pid: int,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
        on_stdout: Optional[OutputHandler[Stdout]] = None,
        on_stderr: Optional[OutputHandler[Stderr]] = None,
    ) -> AsyncCommandHandle:
        """
        Connects to a running command.
        You can use `AsyncCommandHandle.wait()` to wait for the command to finish and get execution results.

        :param pid: Process ID of the command to connect to. You can get the list of processes using `sandbox.commands.list()`
        :param request_timeout: Timeout for opening the stream in **seconds** — the wait until envd confirms with a start event. The running stream is bounded by `timeout`
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param on_stdout: Callback for command stdout output
        :param on_stderr: Callback for command stderr output

        :return: `AsyncCommandHandle` handle to interact with the running command
        """
        events = as_stream(
            self._rpc.connect(
                process_pb.ConnectRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                ),
                headers={
                    KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
                },
                timeout_ms=timeout_to_ms(timeout),
            )
        )

        try:
            start_event = await first_event(
                events, self._connection_config.get_request_timeout(request_timeout)
            )

            pid = extract_start_pid(start_event, "connect to process")
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
