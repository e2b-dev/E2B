from typing import Optional, Callable, Any, Generator, Union, Tuple

from e2b.envd.rpc import handle_rpc_exception
from e2b.envd.process import process_pb2
from e2b.sandbox.commands.command_handle import (
    CommandExitException,
    CommandResult,
    Stderr,
    Stdout,
    PtyOutput,
)


class CommandHandle:
    """
    Command execution handle.

    It provides methods for waiting for the command to finish, retrieving stdout/stderr, and killing the command.
    """

    @property
    def pid(self):
        """
        Command process ID.
        """
        return self._pid

    def __init__(
        self,
        pid: int,
        handle_kill: Callable[[], bool],
        events: Generator[
            Union[process_pb2.StartResponse, process_pb2.ConnectResponse], Any, None
        ],
    ):
        self._pid = pid
        self._handle_kill = handle_kill
        self._events = events

        self._stdout: str = ""
        self._stderr: str = ""

        self._result: Optional[CommandResult] = None
        self._iteration_exception: Optional[Exception] = None

    def __iter__(self):
        """
        Iterate over the command output.

        :return: Generator of command outputs
        """
        return self._handle_events()

    def _handle_events(
        self,
    ) -> Generator[
        Union[
            Tuple[Stdout, None, None],
            Tuple[None, Stderr, None],
            Tuple[None, None, PtyOutput],
        ],
        None,
        None,
    ]:
        try:
            for event in self._events:
                if event.event.HasField("data"):
                    if event.event.data.stdout:
                        out = event.event.data.stdout.decode("utf-8", "replace")
                        self._stdout += out
                        yield out, None, None
                    if event.event.data.stderr:
                        out = event.event.data.stderr.decode("utf-8", "replace")
                        self._stderr += out
                        yield None, out, None
                    if event.event.data.pty:
                        yield None, None, event.event.data.pty
                if event.event.HasField("end"):
                    self._result = CommandResult(
                        stdout=self._stdout,
                        stderr=self._stderr,
                        exit_code=event.event.end.exit_code,
                        error=event.event.end.error,
                    )
        except Exception as e:
            raise handle_rpc_exception(e)

    def disconnect(self) -> None:
        """
        Disconnect from the command.

        The command is not killed, but SDK stops receiving events from the command.
        You can reconnect to the command using `sandbox.commands.connect` method.
        """
        self._events.close()

    def wait(
        self,
        on_pty: Optional[Callable[[PtyOutput], None]] = None,
        on_stdout: Optional[Callable[[str], None]] = None,
        on_stderr: Optional[Callable[[str], None]] = None,
    ) -> CommandResult:
        """
        Wait for the command to finish and returns the result.
        If the command exits with a non-zero exit code, it throws a `CommandExitException`.

        :param on_pty: Callback for pty output
        :param on_stdout: Callback for stdout output
        :param on_stderr: Callback for stderr output

        :return: `CommandResult` result of command execution
        """
        try:
            for stdout, stderr, pty in self:
                if stdout is not None and on_stdout:
                    on_stdout(stdout)
                elif stderr is not None and on_stderr:
                    on_stderr(stderr)
                elif pty is not None and on_pty:
                    on_pty(pty)
        except StopIteration:
            pass
        except Exception as e:
            self._iteration_exception = handle_rpc_exception(e)

        if self._iteration_exception:
            raise self._iteration_exception

        if self._result is None:
            raise Exception("Command ended without an end event")

        if self._result.exit_code != 0:
            raise CommandExitException(
                stdout=self._stdout,
                stderr=self._stderr,
                exit_code=self._result.exit_code,
                error=self._result.error,
            )

        return self._result

    def kill(self) -> bool:
        """
        Kills the command.

        It uses `SIGKILL` signal to kill the command.

        :return: Whether the command was killed successfully
        """
        return self._handle_kill()
