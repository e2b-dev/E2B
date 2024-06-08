import connect

from typing import Dict, List, Optional, Literal, overload, Union, Callable

from e2b.envd.permissions import permissions_pb2
from e2b.envd.process import process_connect, process_pb2
from e2b.sandbox.process.process_handle import ProcessHandle, ProcessResult
from e2b.connection_config import Username


class Process:
    def __init__(self, envd_api_url: str) -> None:
        self._rpc = process_connect.ProcessClient(
            envd_api_url,
            compressor=connect.GzipCompressor,
        )

    def list(self) -> List[process_pb2.ProcessInfo]:
        res = self._rpc.list(
            process_pb2.ListRequest(),
        )
        return [p for p in res.processes]

    def kill(self, pid: int):
        self._rpc.send_signal(
            process_pb2.SendSignalRequest(
                process=process_pb2.ProcessSelector(pid=pid),
                signal=process_pb2.Signal.SIGNAL_SIGKILL,
            ),
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
    ) -> ProcessResult:
        ...

    @overload
    def run(
        self,
        cmd: str,
        background: Literal[True],
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
    ) -> ProcessHandle:
        ...

    def run(
        self,
        cmd: str,
        background: Union[bool, None] = None,
        envs: Optional[Dict[str, str]] = {},
        user: Username = "user",
        cwd: Optional[str] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
    ):
        proc = self._start(cmd, envs, user, cwd)

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
        )

        start_event = next(events)

        return ProcessHandle(
            pid=start_event.event.start.pid,
            handle_kill=lambda: self.kill(start_event.event.start.pid),
            events=events,
        )
