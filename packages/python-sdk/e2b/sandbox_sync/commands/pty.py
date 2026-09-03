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
from e2b.envd.api import check_sandbox_health
from e2b.envd.rpc import handle_rpc_exception_with_health
from e2b.envd.versions import ENVD_COMMANDS_DESCENDANTS
from e2b.envd.utils import (
    authentication_header,
    extract_start_pid,
    timeout_to_ms,
)
from e2b.envd.client_sync import as_stream, create_rpc_client
from e2b.sandbox.commands.command_handle import CommandKillScope, PtySize
from e2b.sandbox_sync.commands.command_handle import CommandHandle
from e2b.exceptions import SandboxException


class Pty:
    """
    Module for interacting with PTYs (pseudo-terminals) in the sandbox.
    """

    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        envd_version: Version,
        envd_api: httpx.Client,
    ) -> None:
        self._connection_config = connection_config
        self._envd_version = envd_version
        self._rpc = create_rpc_client(
            process_connect.ProcessClientSync,
            envd_api_url,
            connection_config,
        )
        self._envd_api = envd_api

    def _check_health(self) -> Optional[bool]:
        return check_sandbox_health(self._envd_api)

    def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
        *,
        scope: CommandKillScope = "process",
    ) -> bool:
        """
        Kill PTY.

        :param pid: Process ID of the PTY
        :param request_timeout: Timeout for the request in **seconds**
        :param scope: Whether to kill only the managed PTY process or its process group

        :return: `true` if the PTY was killed, `false` if the PTY was not found
        """
        if scope == "group" and self._envd_version < ENVD_COMMANDS_DESCENDANTS:
            raise SandboxException(
                f"Sandbox envd version {self._envd_version} doesn't support group-scoped command termination. "
                "Please rebuild your template to pick up the latest sandbox version."
            )

        try:
            self._rpc.send_signal(
                process_pb.SendSignalRequest(
                    process=process_pb.ProcessSelector(selector=Oneof("pid", pid)),
                    signal=process_pb.Signal.SIGKILL,
                    descendants=scope == "group",
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
        :param request_timeout: Not applied to this streaming call — both opening the stream and the stream itself are bounded by `timeout` (unlimited when `0`)

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

            pid = extract_start_pid(start_event, "start process")
            return CommandHandle(
                pid=pid,
                handle_kill=lambda scope="process", request_timeout=None: self.kill(
                    pid, request_timeout, scope=scope
                ),
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
        :param request_timeout: Not applied to this streaming call — both opening the stream and the stream itself are bounded by `timeout` (unlimited when `0`)

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

            pid = extract_start_pid(start_event, "connect to process")
            return CommandHandle(
                pid=pid,
                handle_kill=lambda scope="process", request_timeout=None: self.kill(
                    pid, request_timeout, scope=scope
                ),
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
        try:
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
        except Exception as e:
            raise handle_rpc_exception_with_health(e, self._check_health)
