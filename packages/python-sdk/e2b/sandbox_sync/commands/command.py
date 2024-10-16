from typing import Callable, Dict, List, Literal, Optional, Union, overload

import e2b_connect
import httpcore
from e2b.connection_config import (
    ConnectionConfig,
    Username,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from e2b.envd.process import process_connect, process_pb2
from e2b.envd.rpc import authentication_header, handle_rpc_exception
from e2b.exceptions import SandboxException
from e2b.sandbox.commands.main import ProcessInfo
from e2b.sandbox.commands.command_handle import CommandResult
from e2b.sandbox_sync.commands.command_handle import CommandHandle


class Commands:
    """
    Module for executing commands in the sandbox.
    """

    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        pool: httpcore.ConnectionPool,
    ) -> None:
        self._connection_config = connection_config
        self._rpc = process_connect.ProcessClient(
            envd_api_url,
            # TODO: Fix and enable compression again — the headers compression is not solved for streaming.
            # compressor=e2b_connect.GzipCompressor,
            pool=pool,
            json=True,
        )

    def list(
        self,
        request_timeout: Optional[float] = None,
    ) -> List[ProcessInfo]:
        """
        Lists all running commands and PTY sessions.

        :param request_timeout: Timeout for the request in **seconds**

        :return: List of running commands and PTY sessions
        """
        try:
            res = self._rpc.list(
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

    def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
    ) -> bool:
        """
        Kills a running command specified by its process ID.
        It uses `SIGKILL` signal to kill the command.

        :param pid: Process ID of the command. You can get the list of processes using `sandbox.commands.list()`
        :param request_timeout: Timeout for the request in **seconds**

        :return: `True` if the command was killed, `False` if the command was not found
        """
        try:
            self._rpc.send_signal(
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

    def send_stdin(
        self,
        pid: int,
        data: str,
        request_timeout: Optional[float] = None,
    ):
        """
        Send data to command stdin.

        :param pid Process ID of the command. You can get the list of processes using `sandbox.commands.list()`.
        :param data: Data to send to the command
        :param request_timeout: Timeout for the request in **seconds**
        """
        try:
            self._rpc.send_input(
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
    def run(
        self,
        cmd: str,
        background: Union[Literal[False], None] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
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
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param request_timeout: Timeout for the request in **seconds**

        :return: `CommandResult` result of the command execution
        """
        ...

    @overload
    def run(
        self,
        cmd: str,
        background: Literal[True],
        envs: Optional[Dict[str, str]] = None,
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: None = None,
        on_stderr: None = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> CommandHandle:
        """
        Start a new command and return a handle to interact with it.

        :param cmd: Command to execute
        :param background: `False` if the command should be executed in the foreground, **`True` if the command should be executed in the background**
        :param envs: Environment variables used for the command
        :param user: User to run the command as
        :param cwd: Working directory to run the command
        :param timeout: Timeout for the command connection in **seconds**. Using `0` will not limit the command connection time
        :param request_timeout: Timeout for the request in **seconds**

        :return: `CommandHandle` handle to interact with the running command
        """
        ...

    def run(
        self,
        cmd: str,
        background: Union[bool, None] = None,
        envs: Optional[Dict[str, str]] = None,
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ):
        proc = self._start(
            cmd,
            envs,
            user,
            cwd,
            timeout,
            request_timeout,
        )

        return (
            proc
            if background
            else proc.wait(
                on_stdout=on_stdout,
                on_stderr=on_stderr,
            )
        )

    def _start(
        self,
        cmd: str,
        envs: Optional[Dict[str, str]] = None,
        user: Username = "user",
        cwd: Optional[str] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ):
        events = self._rpc.start(
            process_pb2.StartRequest(
                process=process_pb2.ProcessConfig(
                    cmd="/bin/bash",
                    envs=envs,
                    args=["-l", "-c", cmd],
                    cwd=cwd,
                ),
            ),
            headers={
                **authentication_header(user),
                KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
            },
            timeout=timeout,
            request_timeout=self._connection_config.get_request_timeout(
                request_timeout
            ),
        )

        try:
            start_event = events.__next__()

            if not start_event.HasField("event"):
                raise SandboxException(
                    f"Failed to start process: expected start event, got {start_event}"
                )

            return CommandHandle(
                pid=start_event.event.start.pid,
                handle_kill=lambda: self.kill(start_event.event.start.pid),
                events=events,
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    def connect(
        self,
        pid: int,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ):
        """
        Connects to a running command.
        You can use `CommandHandle.wait()` to wait for the command to finish and get execution results.

        :param pid: Process ID of the command to connect to. You can get the list of processes using `sandbox.commands.list()`
        :param timeout: Timeout for the connection in **seconds**. Using `0` will not limit the connection time
        :param request_timeout: Timeout for the request in **seconds**

        :return: `CommandHandle` handle to interact with the running command
        """
        events = self._rpc.connect(
            process_pb2.ConnectRequest(
                process=process_pb2.ProcessSelector(pid=pid),
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
            start_event = events.__next__()

            if not start_event.HasField("event"):
                raise SandboxException(
                    f"Failed to connect to process: expected start event, got {start_event}"
                )

            return CommandHandle(
                pid=start_event.event.start.pid,
                handle_kill=lambda: self.kill(start_event.event.start.pid),
                events=events,
            )
        except Exception as e:
            raise handle_rpc_exception(e)
