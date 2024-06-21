from dataclasses import dataclass
from typing import Optional, Callable, Any, Generator, Union, Tuple

from e2b.connection_config import SandboxException
from e2b.envd.process import process_pb2

Stdout = str
Stderr = str


@dataclass
class ProcessResult:
    stderr: str
    stdout: str
    exit_code: int
    error: Optional[str]


@dataclass
class ProcessExitException(SandboxException, ProcessResult):
    def __str__(self):
        return f"Process exited with code {self.exit_code} and error: {self.error}"


class ProcessHandle:
    @property
    def pid(self):
        return self._pid

    @property
    def stdout(self):
        return self._stdout

    @property
    def stderr(self):
        return self._stderr

    def __init__(
        self,
        pid: int,
        handle_kill: Callable[[], None],
        events: Generator[
            Union[process_pb2.StartResponse, process_pb2.ConnectResponse], Any, None
        ],
    ):
        self._pid = pid
        self._handle_kill = handle_kill
        self._events = events

        self._stdout: str = ""
        self._stderr: str = ""

        self._result: Optional[ProcessResult] = None

    def __iter__(self):
        return self._handle_events()

    def _handle_events(
        self,
    ) -> Generator[
        Union[Tuple[Stdout, None], Tuple[None, Stderr]],
        None,
        ProcessResult,
    ]:
        try:
            for event in self._events:
                if event.event.HasField("data"):
                    if event.event.data.stdout:
                        out = event.event.data.stdout.decode()
                        self._stdout += out
                        yield out, None
                    if event.event.data.stderr:
                        out = event.event.data.stderr.decode()
                        self._stderr += out
                        yield None, out
                if event.event.HasField("end"):
                    self._result = ProcessResult(
                        stdout=self._stdout,
                        stderr=self._stderr,
                        exit_code=event.event.end.exit_code,
                        error=event.event.end.error,
                    )
        finally:
            self.disconnect()

        if self._result is None:
            raise RuntimeError("Process ended without an end event")

        return self._result

    def disconnect(self) -> None:
        self._events.close()

    def wait(
        self,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
    ):
        for stdout, stderr in self:
            if stdout is not None and on_stdout:
                on_stdout(stdout)
            elif stderr is not None and on_stderr:
                on_stderr(stderr)

        if self._result is None:
            raise RuntimeError("Process ended without an end event")

        if self._result.exit_code != 0:
            raise ProcessExitException(
                stdout=self._stdout,
                stderr=self._stderr,
                exit_code=self._result.exit_code,
                error=self._result.error,
            )

        return self._result

    def kill(self):
        self.disconnect()
        self._handle_kill()
