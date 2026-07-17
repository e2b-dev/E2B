import codecs

from typing import Optional, Callable, Any, Generator, List, Union, Tuple

from e2b.envd.rpc import handle_rpc_exception_with_health
from protobuf import Oneof

from e2b.envd.process import process_pb
from e2b.exceptions import SandboxException
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
            Union[process_pb.StartResponse, process_pb.ConnectResponse], Any, None
        ],
        handle_send_stdin: Optional[
            Callable[[Union[str, bytes], Optional[float]], None]
        ] = None,
        handle_close_stdin: Optional[Callable[[Optional[float]], None]] = None,
        check_health: Optional[Callable[[], Optional[bool]]] = None,
    ):
        self._pid = pid
        self._handle_kill = handle_kill
        self._handle_send_stdin = handle_send_stdin
        self._handle_close_stdin = handle_close_stdin
        self._check_health = check_health
        self._events = events

        self._stdout_chunks: List[str] = []
        self._stderr_chunks: List[str] = []

        self._stdout_decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        self._stderr_decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")

        self._result: Optional[CommandResult] = None
        self._iteration_exception: Optional[Exception] = None

    def __iter__(self):
        """
        Iterate over the command output.

        :return: Generator of command outputs
        """
        return self._handle_events()

    def _flush_decoders(
        self,
    ) -> List[Union[Tuple[Stdout, None, None], Tuple[None, Stderr, None]]]:
        """
        Flush any bytes still buffered in the stream decoders.

        Incomplete trailing UTF-8 sequences are emitted as replacement
        characters, matching the per-chunk decoding behavior.
        """
        events: List[Union[Tuple[Stdout, None, None], Tuple[None, Stderr, None]]] = []
        out = self._stdout_decoder.decode(b"", final=True)
        if out:
            self._stdout_chunks.append(out)
            events.append((out, None, None))
        err = self._stderr_decoder.decode(b"", final=True)
        if err:
            self._stderr_chunks.append(err)
            events.append((None, err, None))
        return events

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
                # `event.event` is the ProcessEvent; its `event` oneof holds the
                # actual payload (start/data/end/keepalive).
                oneof = event.event.event if event.event is not None else None
                match oneof:
                    case Oneof(field="data", value=data):
                        match data.output:
                            case Oneof(field="stdout", value=chunk) if chunk:
                                out = self._stdout_decoder.decode(chunk)
                                if out:
                                    self._stdout_chunks.append(out)
                                    yield out, None, None
                            case Oneof(field="stderr", value=chunk) if chunk:
                                out = self._stderr_decoder.decode(chunk)
                                if out:
                                    self._stderr_chunks.append(out)
                                    yield None, out, None
                            case Oneof(field="pty", value=chunk) if chunk:
                                yield None, None, chunk
                    case Oneof(field="end", value=end):
                        # Flush trailing decoder bytes into the accumulators and
                        # record the result before yielding the flushed chunks, so a
                        # consumer that stops iterating on the first flushed chunk
                        # still observes the exit code.
                        flushed = list(self._flush_decoders())
                        self._result = CommandResult(
                            stdout="".join(self._stdout_chunks),
                            stderr="".join(self._stderr_chunks),
                            exit_code=end.exit_code,
                            # Optional scalar: unset reads as "" — the presence
                            # check keeps it None, matching the JS SDK
                            error=end.error if end.has_field("error") else None,
                        )
                        yield from flushed

            # If the stream closed without an end event (e.g. disconnect or a
            # dropped connection), flush any bytes still buffered in the
            # decoders so incomplete trailing sequences surface as replacement
            # characters instead of being silently dropped.
            if self._result is None:
                yield from self._flush_decoders()
        except Exception as e:
            # The stream raised before an end event (e.g. disconnect or RPC
            # failure). Flush any bytes still buffered in the decoders so
            # incomplete trailing sequences surface as replacement characters
            # instead of being silently dropped, then surface the error.
            yield from self._flush_decoders()
            raise handle_rpc_exception_with_health(e, self._check_health)

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
            self._iteration_exception = handle_rpc_exception_with_health(
                e, self._check_health
            )

        if self._iteration_exception:
            raise self._iteration_exception

        if self._result is None:
            raise Exception("Command ended without an end event")

        if self._result.exit_code != 0:
            raise CommandExitException(
                stdout="".join(self._stdout_chunks),
                stderr="".join(self._stderr_chunks),
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

    def send_stdin(
        self,
        data: Union[str, bytes],
        request_timeout: Optional[float] = None,
    ) -> None:
        """
        Send data to the command stdin.

        The command must have been started with `stdin=True`.

        :param data: Data to send to the command
        :param request_timeout: Timeout for the request in **seconds**
        """
        if self._handle_send_stdin is None:
            raise SandboxException(
                "Sending stdin is not supported for this command handle."
            )
        self._handle_send_stdin(data, request_timeout)

    def close_stdin(self, request_timeout: Optional[float] = None) -> None:
        """
        Close the command stdin.

        This signals EOF to the command. The command must have been started with `stdin=True`.

        :param request_timeout: Timeout for the request in **seconds**
        """
        if self._handle_close_stdin is None:
            raise SandboxException(
                "Closing stdin is not supported for this command handle."
            )
        self._handle_close_stdin(request_timeout)
