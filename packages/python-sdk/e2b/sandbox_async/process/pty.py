from typing import Callable, Dict, Optional

import e2b_connect
import httpcore

from typing import Dict, Optional

from e2b.envd.process import process_connect, process_pb2
from e2b.connection_config import (
    Username,
    ConnectionConfig,
    KEEPALIVE_PING_HEADER,
    KEEPALIVE_PING_INTERVAL_SEC,
)
from e2b.exceptions import SandboxException
from e2b.envd.rpc import authentication_header, handle_rpc_exception
from e2b.exceptions import SandboxException
from e2b.sandbox.process.process_handle import PtySize
from e2b.sandbox_async.process.process_handle import (
    AsyncProcessHandle,
    OutputHandler,
    PtyOutput,
)


class Pty:
    """
    Manager for starting and interacting with PTY (pseudo-terminal) processes in the sandbox.
    """

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
            json=True,
        )

    async def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
    ) -> bool:
        """
        Kills a process.

        :param pid: Process ID to kill. You can get the list of processes using `sandbox.commands.list()`.
        :param request_timeout: Timeout for the request
        :return: `true` if the process was killed, `false` if the process was not found
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
            raise handle_rpc_exception(e)

    async def send_stdin(
        self,
        pid: int,
        data: bytes,
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Sends input to a PTY process.

        :param pid: Process ID of the PTY process
        :param data: Input data to send
        :param request_timeout: Timeout for the request
        """
        try:
            await self._rpc.asend_input(
                process_pb2.SendInputRequest(
                    process=process_pb2.ProcessSelector(pid=pid),
                    input=process_pb2.ProcessInput(
                        pty=data,
                    ),
                ),
                request_timeout=self._connection_config.get_request_timeout(
                    request_timeout
                ),
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def create(
        self,
        size: PtySize,
        on_data: OutputHandler[PtyOutput],
        user: Username = "user",
        cwd: Optional[str] = None,
        envs: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = 60,
        request_timeout: Optional[float] = None,
    ) -> AsyncProcessHandle:
        """
        Starts a new process with a PTY (pseudo-terminal).

        :param size: Size of the PTY
        :param on_data: Callback for handling PTY output
        :param user: User to start the process as
        :param cwd: Current working directory
        :param envs: Environment variables
        :param timeout: Timeout for the request
        :param request_timeout: Timeout for the request
        :return: New process
        """
        envs = envs or {}
        envs["TERM"] = "xterm-256color"
        events = self._rpc.astart(
            process_pb2.StartRequest(
                process=process_pb2.ProcessConfig(
                    cmd="/bin/bash",
                    envs=envs,
                    args=["-i", "-l"],
                    cwd=cwd,
                ),
                pty=process_pb2.PTY(
                    size=process_pb2.PTY.Size(rows=size.rows, cols=size.cols)
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
            start_event = await events.__anext__()

            if not start_event.HasField("event"):
                raise SandboxException(
                    f"Failed to start process: expected start event, got {start_event}"
                )

            return AsyncProcessHandle(
                pid=start_event.event.start.pid,
                handle_kill=lambda: self.kill(start_event.event.start.pid),
                events=events,
                on_pty=on_data,
            )
        except Exception as e:
            raise handle_rpc_exception(e)

    async def resize(
        self,
        pid: int,
        size: PtySize,
        request_timeout: Optional[float] = None,
    ):
        """
        Resizes a PTY process (changes the number of columns and rows in the terminal).

        :param pid: Process ID of the PTY process
        :param size: New size of the PTY
        :param request_timeout: Timeout for the request
        """
        await self._rpc.aupdate(
            process_pb2.UpdateRequest(
                process=process_pb2.ProcessSelector(pid=pid),
                pty=process_pb2.PTY(
                    size=process_pb2.PTY.Size(rows=size.rows, cols=size.cols),
                ),
            ),
            request_timeout=self._connection_config.get_request_timeout(
                request_timeout
            ),
        )
