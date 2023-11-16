import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import (
    Any,
    Callable,
    ClassVar,
    Dict,
    List,
    Optional,
)

from pydantic import BaseModel

from e2b.constants import TIMEOUT
from e2b.sandbox.env_vars import EnvVars
from e2b.sandbox.exception import (
    MultipleExceptions,
    ProcessException,
    RpcException,
    CurrentWorkingDirectoryDoesntExistException,
)
from e2b.sandbox.out import OutStderrResponse, OutStdoutResponse
from e2b.sandbox.sandbox_connection import SandboxConnection
from e2b.utils.future import DeferredFuture
from e2b.utils.id import create_id
from e2b.utils.threads import shutdown_executor

logger = logging.getLogger(__name__)


class ProcessMessage(BaseModel):
    """
    A message from a process.
    """

    line: str
    error: bool = False
    timestamp: int
    """
    Unix epoch in nanoseconds
    """

    def __str__(self):
        return self.line


class ProcessOutput(BaseModel):
    """
    Output from a process.
    """

    delimiter: ClassVar[str] = "\n"
    messages: List[ProcessMessage] = []

    error: bool = False
    exit_code: Optional[int] = None

    @property
    def stdout(self) -> str:
        """
        The stdout from the process.
        """
        return self.delimiter.join(out.line for out in self.messages if not out.error)

    @property
    def stderr(self) -> str:
        """
        The stderr from the process.
        """
        return self.delimiter.join(out.line for out in self.messages if out.error)

    def _insert_by_timestamp(self, message: ProcessMessage):
        """Insert an out based on its timestamp using insertion sort."""
        i = len(self.messages) - 1
        while i >= 0 and self.messages[i].timestamp > message.timestamp:
            i -= 1
        self.messages.insert(i + 1, message)

    def _add_stdout(self, message: ProcessMessage):
        self._insert_by_timestamp(message)

    def _add_stderr(self, message: ProcessMessage):
        self.error = True
        self._insert_by_timestamp(message)


class Process:
    """
    A process running in the sandbox.
    """

    def __init__(
        self,
        process_id: str,
        sandbox: SandboxConnection,
        trigger_exit: Callable[[], Any],
        finished: DeferredFuture[ProcessOutput],
        output: ProcessOutput,
    ):
        self._process_id = process_id
        self._sandbox = sandbox
        self._trigger_exit = trigger_exit
        self._finished = finished
        self._output = output

    @property
    def exit_code(self) -> Optional[int]:
        """
        The exit code of the last process started by this manager.
        """
        if not self.finished:
            raise ProcessException("Process has not finished yet")
        return self.output.exit_code

    @property
    def output(self) -> ProcessOutput:
        """
        The output from the process.
        """
        return self._output

    @property
    def stdout(self) -> str:
        """
        The stdout from the process.
        """
        return self._output.stdout

    @property
    def stderr(self) -> str:
        """
        The stderr from the process.
        """
        return self._output.stderr

    @property
    def error(self) -> bool:
        """
        True if the process has written to stderr.
        """
        return self._output.error

    @property
    def output_messages(self) -> List[ProcessMessage]:
        """
        The output messages from the process.
        """
        return self._output.messages

    @property
    def finished(self):
        """
        A future that is resolved when the process exits.
        """
        return self._finished

    @property
    def process_id(self) -> str:
        """
        The process id used to identify the process in the sandbox.
        This is not the system process id of the process running in the sandbox.
        """
        return self._process_id

    def wait(self):
        """
        Wait for the process to exit.
        """
        return self._finished.result()

    def send_stdin(self, data: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Send data to the process stdin.

        :param data: Data to send
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        try:
            self._sandbox._call(
                ProcessManager._service_name,
                "stdin",
                [self.process_id, data],
                timeout=timeout,
            )
        except RpcException as e:
            raise ProcessException(e.message) from e

    def kill(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Kill the process.

        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        try:
            self._sandbox._call(
                ProcessManager._service_name, "kill", [self.process_id], timeout=timeout
            )
        except RpcException as e:
            raise ProcessException(e.message) from e
        self._trigger_exit()


class ProcessManager:
    """
    Manager for starting and interacting with processes in the sandbox.
    """

    _service_name = "process"

    def __init__(
        self,
        sandbox: SandboxConnection,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
    ):
        self._sandbox = sandbox
        self._process_cleanup: List[Callable[[], Any]] = []
        self._on_stdout = on_stdout
        self._on_stderr = on_stderr
        self._on_exit = on_exit

    def _close(self):
        for cleanup in self._process_cleanup:
            cleanup()

        self._process_cleanup.clear()

    def start(
        self,
        cmd: str,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        env_vars: Optional[EnvVars] = None,
        cwd: str = "",
        rootdir: str = "",  # DEPRECATED
        process_id: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Process:
        logger.info(f"Starting process: {cmd}")
        env_vars = env_vars or {}
        env_vars = {**self._sandbox.env_vars, **env_vars}

        on_stdout = on_stdout or self._on_stdout
        on_stderr = on_stderr or self._on_stderr
        on_exit = on_exit or self._on_exit

        future_exit = DeferredFuture(self._process_cleanup)
        process_id = process_id or create_id(12)

        unsub_all: Optional[Callable] = None

        output = ProcessOutput()

        def handle_exit(exit_code: int):
            output.exit_code = exit_code
            logger.info(f"Process {process_id} exited with exit code {exit_code}")
            future_exit(True)

        def handle_stdout(data: Dict[Any, Any]):
            out = OutStdoutResponse(**data)

            message = ProcessMessage(
                line=out.line,
                timestamp=out.timestamp,
                error=False,
            )

            output._add_stdout(message)
            if on_stdout:
                try:
                    on_stdout(message)
                except TypeError as error:
                    logger.exception(f"Error in on_stdout callback: {error}")

        def handle_stderr(data: Dict[Any, Any]):
            out = OutStderrResponse(**data)

            message = ProcessMessage(
                line=out.line,
                timestamp=out.timestamp,
                error=True,
            )

            output._add_stderr(message)
            if on_stderr:
                try:
                    on_stderr(message)
                except TypeError as error:
                    logger.exception(f"Error in on_stdout callback: {error}")

        try:
            unsub_all = self._sandbox._handle_subscriptions(
                self._sandbox._subscribe(
                    self._service_name, handle_exit, "onExit", process_id
                ),
                self._sandbox._subscribe(
                    self._service_name, handle_stdout, "onStdout", process_id
                ),
                self._sandbox._subscribe(
                    self._service_name, handle_stderr, "onStderr", process_id
                ),
            )
        except (RpcException, MultipleExceptions) as e:
            future_exit.cancel()

            if isinstance(e, RpcException):
                raise ProcessException(e.message) from e
            elif isinstance(e, MultipleExceptions):
                raise ProcessException(
                    "Failed to subscribe to RPC services necessary for starting process"
                ) from e

        future_exit_handler_finish = DeferredFuture[ProcessOutput](
            self._process_cleanup
        )

        def exit_handler():
            future_exit.result()
            logger.info(
                f"Handling process exit (id: {process_id})",
            )
            if unsub_all:
                unsub_all()
            if on_exit:
                try:
                    on_exit(output.exit_code or 0)
                except TypeError as error:
                    logger.exception(f"Error in on_exit callback: {error}")
            future_exit_handler_finish(output)

        executor = ThreadPoolExecutor(thread_name_prefix="e2b-process-exit-handler")
        exit_task = executor.submit(exit_handler)

        self._process_cleanup.append(exit_task.cancel)
        self._process_cleanup.append(lambda: shutdown_executor(executor))

        def trigger_exit():
            logger.info(f"Exiting the process (id: {process_id})")
            future_exit(None)
            future_exit_handler_finish.result()
            logger.debug(f"Exited the process (id: {process_id})")

        try:
            if not cwd and rootdir:
                cwd = rootdir
                logger.warning("The rootdir parameter is deprecated, use cwd instead.")

            if not cwd and self._sandbox.cwd:
                cwd = self._sandbox.cwd

            self._sandbox._call(
                self._service_name,
                "start",
                [
                    process_id,
                    cmd,
                    env_vars,
                    cwd,
                ],
                timeout=timeout,
            )
            logger.info(f"Started process (id: {process_id})")
            return Process(
                output=output,
                sandbox=self._sandbox,
                process_id=process_id,
                trigger_exit=trigger_exit,
                finished=future_exit_handler_finish,
            )
        except RpcException as e:
            trigger_exit()
            if re.match(
                r"error starting process '\w+': fork/exec /bin/bash: no such file or directory",
                e.message,
            ):
                raise CurrentWorkingDirectoryDoesntExistException(
                    "Failed to start the process. You are trying set `cwd` to a directory that does not exist."
                ) from e
            raise ProcessException(e.message) from e
        except TimeoutError as e:
            logger.error(f"Timeout error during starting the process: {cmd}")
            trigger_exit()
            raise e

    def start_and_wait(
        self,
        cmd: str,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[int], Any]] = None,
        env_vars: Optional[EnvVars] = None,
        cwd: str = "",
        process_id: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> ProcessOutput:
        return self.start(
            cmd,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            env_vars=env_vars,
            cwd=cwd,
            process_id=process_id,
            timeout=timeout,
        ).wait()
