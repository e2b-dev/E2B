import logging
import connect

from typing import Dict, Optional, Callable, Any, Generator, Union

from envd.process.v1 import process_connect, process_pb2

logger = logging.getLogger(__name__)


class ProcessOutput:
    def __init__(self, stdout: Optional[bytes], stderr: Optional[bytes]) -> None:
        self.stdout = str(stdout) if stdout else None
        self.stderr = str(stderr) if stderr else None


class ProcessHandle:
    def __init__(
        self,
        pid: int,
        kill: Callable[[], None],
        events: Generator[
            Union[process_pb2.StartResponse, process_pb2.ConnectResponse], Any, None
        ],
    ):
        self.pid = pid
        self.kill = kill
        self._events = events

        self._stdout: bytes = b""
        self._stderr: bytes = b""

        self._end_event: Union[process_pb2.ProcessEvent.EndEvent, None] = None

    def __next__(self):
        event = next(self._events)

        if event.HasField("data"):
            if event.event.data.stdout:
                self._stdout += event.event.data.stdout
                return ProcessOutput(self._stdout, None)
            if event.event.data.stderr:
                self._stderr += event.event.data.stderr
                return ProcessOutput(None, self._stderr)
        if event.HasField("end"):
            self._end_event = event.event.end

        raise StopIteration

    def __iter__(self):
        return self

    def wait(self):
        for _ in self:
            pass

        if self._end_event is None:
            raise RuntimeError("Process has not ended")

        return ProcessResult(
            stdout=self._stdout,
            stderr=self._stderr,
            exit_code=self._end_event.exit_code,
            error=self._end_event.error,
        )


class ProcessResult(ProcessOutput):
    def __init__(
        self,
        stdout: bytes,
        stderr: bytes,
        exit_code: int,
        error: Optional[str] = None,
    ) -> None:
        super().__init__(stdout, stderr)
        self.exit_code = exit_code
        self.error = error


# TODO: Add disconnect for process handle
class Process:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url

        self._service = process_connect.ProcessServiceClient(
            self.base_url,
            compressor=connect.GzipCompressor,
        )

    def list(self):
        params = process_pb2.ListRequest()

        res = self._service.list(params)
        return [p for p in res.processes]

    def kill(self, pid: int):
        params = process_pb2.SendSignalRequest(
            process=process_pb2.ProcessSelector(pid=pid),
            signal=process_pb2.Signal.SIGNAL_SIGKILL,
        )

        self._service.send_signal(params)

    def sendStdin(self, pid: int, data: bytes):
        params = process_pb2.SendInputRequest(
            process=process_pb2.ProcessSelector(pid=pid),
            input=process_pb2.ProcessInput(stdin=data),
        )

        self._service.send_input(params)

    def start(
        self,
        cmd: str,
        envs: Optional[Dict[str, str]] = {},
        user: str = "user",
        cwd: Optional[str] = None,
    ):
        params = process_pb2.StartRequest(
            owner=process_pb2.Credential(username=user),
            process=process_pb2.ProcessConfig(
                cmd=cmd,
                envs=envs,
                cwd=cwd,
            ),
        )

        events = self._service.start(params)

        start_event = next(events)

        return ProcessHandle(
            pid=start_event.event.start.pid,
            kill=lambda: self.kill(start_event.event.start.pid),
            events=events,
        )

    def connect(self, pid: int):
        params = process_pb2.ConnectRequest(
            process=process_pb2.ProcessSelector(pid=pid),
        )

        events = self._service.connect(params)

        return ProcessHandle(
            pid=pid,
            kill=lambda: self.kill(pid),
            events=events,
        )
