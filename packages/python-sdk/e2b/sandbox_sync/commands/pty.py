import httpx
import threading

from typing import Dict, Optional

from connectrpc.code import Code
from connectrpc.errors import ConnectError
from packaging.version import Version
from e2b.api import make_logging_event_hooks
from e2b.api.client_sync import get_envd_transport
from protobuf import Oneof

from e2b.envd.process import process_connect, process_pb
from e2b.connection_config import (
    Username,
    ConnectionConfig,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from e2b.exceptions import SandboxException
from e2b.envd.api import check_sandbox_health
from e2b.envd.rpc import (
    authentication_header,
    handle_rpc_exception_with_health,
    timeout_to_ms,
)
from e2b.envd.transport import as_stream, create_rpc_client
from e2b.sandbox.commands.command_handle import PtySize
from e2b.sandbox_sync.commands.command_handle import CommandHandle


class Pty:
    """
    Module for interacting with PTYs (pseudo-terminals) in the sandbox.
    """

    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        envd_version: Version,
    ) -> None:
        self._envd_api_url = envd_api_url
        self._connection_config = connection_config
        self._envd_version = envd_version
        self._thread_local = threading.local()

    def _create_envd_api(self) -> httpx.Client:
        transport = get_envd_transport(self._connection_config)
        return httpx.Client(
            base_url=self._envd_api_url,
            transport=transport,
            headers=self._connection_config.sandbox_headers,
            event_hooks=make_logging_event_hooks(self._connection_config.logger),
        )

    def _create_rpc(self) -> process_connect.ProcessClientSync:
        return create_rpc_client(
            process_connect.ProcessClientSync,
            self._envd_api_url,
            self._connection_config,
            sync=True,
        )

    @property
    def _envd_api(self) -> httpx.Client:
        envd_api = getattr(self._thread_local, "envd_api", None)
        if envd_api is None:
            envd_api = self._create_envd_api()
            self._thread_local.envd_api = envd_api
        return envd_api

    @property
    def _rpc(self) -> process_connect.ProcessClientSync:
        rpc = getattr(self._thread_local, "rpc", None)
        if rpc is None:
            rpc = self._create_rpc()
            self._thread_local.rpc = rpc
        return rpc

    def _check_health(self) -> Optional[bool]:
        return check_sandbox_health(self._envd_api)

    def kill(
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
            self._rpc.send_signal(
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
            raise handle_rpc_exception_with_health(e, self._check_health)

    def send_stdin(
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
            self._rpc.send_input(
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
            raise handle_rpc_exception_with_health(e, self._check_health)

    def create(
        self,
        size: PtySize,
        user: Optional[Username] = None,
        cwd: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> CommandHandle:
        """
        Start a new PTY (pseudo-terminal).

        :param size: Size of the PTY
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
        events = as_stream(
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
            start_event = events.__next__()

            match start_event.event.event if start_event.event is not None else None:
                case Oneof(field="start", value=start):
                    pid = start.pid
                case _:
                    raise SandboxException(
                        f"Failed to start process: expected start event, got {start_event}"
                    )
            return CommandHandle(
                pid=pid,
                handle_kill=lambda: self.kill(pid),
                events=events,
                check_health=self._check_health,
            )
        except Exception as e:
            try:
                events.close()
            except Exception:
                pass
            raise handle_rpc_exception_with_health(e, self._check_health)

    def connect(
        self,
        pid: int,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> CommandHandle:
        """
        Connect to a running PTY.

        :param pid: Process ID of the PTY to connect to. You can get the list of running PTYs using `sandbox.pty.list()`.
        :param timeout: Timeout for the PTY connection in **seconds**. Using `0` will not limit the connection time
        :param request_timeout: Timeout for the request in **seconds**

        :return: Handle to interact with the PTY
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
            start_event = events.__next__()

            match start_event.event.event if start_event.event is not None else None:
                case Oneof(field="start", value=start):
                    pid = start.pid
                case _:
                    raise SandboxException(
                        f"Failed to connect to process: expected start event, got {start_event}"
                    )
            return CommandHandle(
                pid=pid,
                handle_kill=lambda: self.kill(pid),
                events=events,
                check_health=self._check_health,
            )
        except Exception as e:
            try:
                events.close()
            except Exception:
                pass
            raise handle_rpc_exception_with_health(e, self._check_health)

    def resize(
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
        self._rpc.update(
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
