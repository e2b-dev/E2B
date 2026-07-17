from typing import Dict, Optional

import httpx

from connectrpc.code import Code
from connectrpc.errors import ConnectError
from packaging.version import Version
from protobuf import Oneof

from e2b.envd.process import process_connect, process_pb
from e2b.connection_config import (
    Username,
    ConnectionConfig,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from e2b.exceptions import SandboxException
from e2b.envd.api import acheck_sandbox_health
from e2b.envd.rpc import (
    authentication_header,
    ahandle_rpc_exception_with_health,
    timeout_to_ms,
)
from e2b.envd.transport import as_async_stream, create_rpc_client
from e2b.sandbox.commands.command_handle import PtySize
from e2b.sandbox_async.commands.command_handle import (
    AsyncCommandHandle,
    OutputHandler,
    PtyOutput,
)


class Pty:
    """
    Module for interacting with PTYs (pseudo-terminals) in the sandbox.
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
            sync=False,
        )

    async def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
    ) -> bool:
        """
        Kill PTY.

        :param pid: Process ID of the PTY
        :param request_timeout: Timeout for the request in **seconds**

        :return: `true` if the PTY was killed, `false` if the PTY was not found
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
        data: bytes,
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Send input to a PTY.

        :param pid: Process ID of the PTY
        :param data: Input data to send
        :param request_timeout: Timeout for the request in **seconds**
        """
        try:
            await self._rpc.send_input(
                process_pb.SendInputRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                    input=process_pb.ProcessInput(
                        input=Oneof("pty", data),
                    ),
                ),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
            )
        except Exception as e:
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    async def create(
        self,
        size: PtySize,
        on_data: OutputHandler[PtyOutput],
        user: Optional[Username] = None,
        cwd: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> AsyncCommandHandle:
        """
        Start a new PTY (pseudo-terminal).

        :param size: Size of the PTY
        :param on_data: Callback to handle PTY data
        :param user: User to use for the PTY
        :param cwd: Working directory for the PTY
        :param envs: Environment variables for the PTY
        :param timeout: Timeout for the PTY in **seconds**
        :param request_timeout: Timeout for the request in **seconds**

        :return: Handle to interact with the PTY
        """
        envs = dict(envs) if envs else {}
        envs.setdefault("TERM", "xterm-256color")
        envs.setdefault("LANG", "C.UTF-8")
        envs.setdefault("LC_ALL", "C.UTF-8")
        events = as_async_stream(
            self._rpc.start(
                process_pb.StartRequest(
                    process=process_pb.ProcessConfig(
                        cmd="/bin/bash",
                        envs=envs,
                        args=["-i", "-l"],
                        cwd=cwd,
                    ),
                    pty=process_pb.PTY(
                        size=process_pb.PTY.Size(rows=size.rows, cols=size.cols)
                    ),
                ),
                headers={
                    **authentication_header(self._envd_version, user),
                    KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
                },
                timeout_ms=timeout_to_ms(timeout),
            )
        )

        try:
            start_event = await events.__anext__()

            match start_event.event.event if start_event.event is not None else None:
                case Oneof(field="start", value=start):
                    pid = start.pid
                case _:
                    raise SandboxException(
                        f"Failed to start process: expected start event, got {start_event}"
                    )
            return AsyncCommandHandle(
                pid=pid,
                handle_kill=lambda: self.kill(pid),
                events=events,
                on_pty=on_data,
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
        on_data: OutputHandler[PtyOutput],
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> AsyncCommandHandle:
        """
        Connect to a running PTY.

        :param pid: Process ID of the PTY to connect to. You can get the list of running PTYs using `sandbox.pty.list()`.
        :param on_data: Callback to handle PTY data
        :param timeout: Timeout for the PTY connection in **seconds**. Using `0` will not limit the connection time
        :param request_timeout: Timeout for the request in **seconds**

        :return: Handle to interact with the PTY
        """
        events = as_async_stream(
            self._rpc.connect(
                process_pb.ConnectRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                ),
                timeout_ms=timeout_to_ms(timeout),
                headers={
                    KEEPALIVE_PING_HEADER: str(KEEPALIVE_PING_INTERVAL_SEC),
                },
            )
        )

        try:
            start_event = await events.__anext__()

            match start_event.event.event if start_event.event is not None else None:
                case Oneof(field="start", value=start):
                    pid = start.pid
                case _:
                    raise SandboxException(
                        f"Failed to connect to process: expected start event, got {start_event}"
                    )
            return AsyncCommandHandle(
                pid=pid,
                handle_kill=lambda: self.kill(pid),
                events=events,
                on_pty=on_data,
                check_health=self._check_health,
            )
        except Exception as e:
            try:
                await events.aclose()
            except Exception:
                pass
            raise await ahandle_rpc_exception_with_health(e, self._check_health)

    async def resize(
        self,
        pid: int,
        size: PtySize,
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Resize PTY.
        Call this when the terminal window is resized and the number of columns and rows has changed.

        :param pid: Process ID of the PTY
        :param size: New size of the PTY
        :param request_timeout: Timeout for the request in **seconds**
        """
        try:
            await self._rpc.update(
                process_pb.UpdateRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                    pty=process_pb.PTY(
                        size=process_pb.PTY.Size(rows=size.rows, cols=size.cols),
                    ),
                ),
                timeout_ms=timeout_to_ms(
                    self._connection_config.get_request_timeout(request_timeout)
                ),
            )
        except Exception as e:
            raise await ahandle_rpc_exception_with_health(e, self._check_health)
