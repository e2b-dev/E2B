from dataclasses import dataclass
import connect
import httpcore

from typing import Dict, List, Optional, Literal, overload, Union, Callable

from e2b.envd.permissions import permissions_pb2
from e2b.envd.process import process_connect, process_pb2
from e2b.sandbox.process.process_handle import ProcessHandle, ProcessResult
from e2b.connection_config import SandboxException, Username, ConnectionConfig


@dataclass
class ProcessInfo:
    pid: int
    tag: Optional[str]
    cmd: str
    args: List[str]
    envs: Dict[str, str]
    cwd: Optional[str]


class Process:
    def __init__(
        self,
        envd_api_url: str,
        connection_config: ConnectionConfig,
        pool: httpcore.ConnectionPool,
    ) -> None:
        self._connection_config = connection_config
        self._rpc = process_connect.ProcessClient(
            envd_api_url,
            compressor=connect.GzipCompressor,
            pool=pool,
        )

    def list(
        self,
        request_timeout: Optional[float] = None,
    ) -> List[ProcessInfo]:
        res = self._rpc.list(
            process_pb2.ListRequest(),
            timeout=self._connection_config.get_request_timeout(request_timeout),
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

    def kill(
        self,
        pid: int,
        request_timeout: Optional[float] = None,
    ):
        self._rpc.send_signal(
            process_pb2.SendSignalRequest(
                process=process_pb2.ProcessSelector(pid=pid),
                signal=process_pb2.Signal.SIGNAL_SIGKILL,
            ),
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

    def send_stdin(
        self,
        pid: int,
        data: str,
        request_timeout: Optional[float] = None,
    ):
        self._rpc.send_input(
            process_pb2.SendInputRequest(
                process=process_pb2.ProcessSelector(pid=pid),
                input=process_pb2.ProcessInput(
                    stdin=data.encode(),
                ),
            ),
            timeout=self._connection_config.get_request_timeout(request_timeout),
        )

    @overload
    def run(
        self,
        cmd: str,
        background: Union[Literal[False], None] = None,
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> ProcessResult: ...

    @overload
    def run(
        self,
        cmd: str,
        background: Literal[True],
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ) -> ProcessHandle: ...

    def run(
        self,
        cmd: str,
        background: Union[bool, None] = None,
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
        timeout: Optional[float] = None,
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
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        events = self._rpc.start(
            process_pb2.StartRequest(
                user=permissions_pb2.User(username=user),
                process=process_pb2.ProcessConfig(
                    cmd="/bin/bash",
                    envs=envs,
                    args=["-l", "-c", cmd],
                    cwd=cwd,
                ),
            ),
            timeout=(
                self._connection_config.get_request_timeout(request_timeout),
                timeout,
            ),
        )

        try:
            start_event = next(events)

            return ProcessHandle(
                pid=start_event.event.start.pid,
                handle_kill=lambda: self.kill(start_event.event.start.pid),
                events=events,
            )
        except Exception as e:
            raise SandboxException(f"Failed to start process: {e}")

    def connect(
        self,
        pid: int,
        timeout: Optional[float] = None,
        request_timeout: Optional[float] = None,
    ):
        events = self._rpc.connect(
            process_pb2.ConnectRequest(
                process=process_pb2.ProcessSelector(pid=pid),
            ),
            timeout=(
                self._connection_config.get_request_timeout(request_timeout),
                timeout,
            ),
        )

        try:
            start_event = next(events)

            return ProcessHandle(
                pid=start_event.event.start.pid,
                handle_kill=lambda: self.kill(start_event.event.start.pid),
                events=events,
            )
        except Exception as e:
            raise SandboxException(f"Failed to start process: {e}")
