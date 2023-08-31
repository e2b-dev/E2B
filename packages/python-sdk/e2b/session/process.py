import asyncio
import logging
from asyncio.exceptions import TimeoutError
from typing import Any, Awaitable, Callable, ClassVar, Coroutine, Dict, List, Optional

import async_timeout
from e2b.constants import TIMEOUT
from e2b.session.env_vars import EnvVars
from e2b.session.exception import MultipleExceptions, ProcessException, RpcException
from e2b.session.out import OutStderrResponse, OutStdoutResponse
from e2b.session.session_connection import SessionConnection
from e2b.utils.future import DeferredFuture
from e2b.utils.id import create_id
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ProcessMessage(BaseModel):
    """
    A message from a process
    """

    line: str
    error: bool = False
    timestamp: int
    """
    Unix epoch in nanoseconds
    """


class ProcessOutput(BaseModel):
    """
    Output from a process.
    """

    delimiter: ClassVar[str] = "\n"
    messages: List[ProcessMessage] = []

    error = False

    @property
    def stdout(self) -> str:
        """
        The stdout from the process
        """
        return self.delimiter.join(out.line for out in self.messages if not out.error)

    @property
    def stderr(self) -> str:
        """
        The stderr from the process
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
    A process running in the environment.
    """

    @property
    def output(self) -> ProcessOutput:
        """
        The output from the process
        """
        return self._output

    @property
    def stdout(self) -> str:
        """
        The stdout from the process
        """
        return self._output.stdout

    @property
    def stderr(self) -> str:
        """
        The stderr from the process
        """
        return self._output.stderr

    @property
    def error(self) -> bool:
        """
        True if the process has written to stderr
        """
        return self._output.error

    @property
    def output_messages(self) -> List[ProcessMessage]:
        """
        The output messages from the process
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
        The process id used to identify the process in the session.
        This is not the system process id of the process running in the environment session.
        """
        return self._process_id

    def __await__(self):
        return self._finished.__await__()

    def __init__(
        self,
        process_id: str,
        session: SessionConnection,
        trigger_exit: Callable[[], Coroutine[Any, Any, None]],
        finished: Awaitable[ProcessOutput],
        output: ProcessOutput,
    ):
        self._process_id = process_id
        self._session = session
        self._trigger_exit = trigger_exit
        self._finished = finished
        self._output = output

    async def send_stdin(self, data: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Sends data to the process stdin.

        :param data: Data to send
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        try:
            await self._session._call(
                ProcessManager._service_name,
                "stdin",
                [self.process_id, data],
                timeout=timeout,
            )
        except RpcException as e:
            raise ProcessException(e.message) from e

    async def kill(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Kills the process.

        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        try:
            await self._session._call(
                ProcessManager._service_name, "kill", [self.process_id], timeout=timeout
            )
        except RpcException as e:
            raise ProcessException(e.message) from e
        await self._trigger_exit()


class ProcessManager:
    """
    Manager for starting and interacting with processes in the environment.
    """

    _service_name = "process"

    def __init__(self, session: SessionConnection):
        self._session = session
        self._process_cleanup: List[Callable[[], Any]] = []

    def _close(self):
        for cleanup in self._process_cleanup:
            cleanup()

        self._process_cleanup.clear()

    async def start(
        self,
        cmd: str,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[], Any]] = None,
        env_vars: Optional[EnvVars] = None,
        rootdir: str = "",
        process_id: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Process:
        """
        Starts a process in the environment.

        :param cmd: The command to run
        :param on_stdout: A callback that is called when stdout with a newline is received from the process
        :param on_stderr: A callback that is called when stderr with a newline is received from the process
        :param on_exit: A callback that is called when the process exits
        :param env_vars: A dictionary of environment variables to set for the process
        :param rootdir: The root directory for the process
        :param process_id: The process id to use for the process. If not provided, a random id is generated
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time

        :return: A process object
        """
        logger.info(f"Starting process (id: {process_id})")
        async with async_timeout.timeout(timeout):
            if not env_vars:
                env_vars = {}

            future_exit = DeferredFuture(self._process_cleanup)
            process_id = process_id or create_id(12)

            unsub_all: Optional[Callable[[], Awaitable[Any]]] = None

            output = ProcessOutput()

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
                unsub_all = await self._session._handle_subscriptions(
                    self._session._subscribe(
                        self._service_name, future_exit, "onExit", process_id
                    ),
                    self._session._subscribe(
                        self._service_name, handle_stdout, "onStdout", process_id
                    ),
                    self._session._subscribe(
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

            async def exit_handler():
                await future_exit
                logger.info(
                    f"Handling process exit (id: {process_id})",
                )
                if unsub_all:
                    await unsub_all()
                if on_exit:
                    try:
                        on_exit()
                    except TypeError as error:
                        logger.exception(f"Error in on_exit callback: {error}")
                future_exit_handler_finish(output)

            exit_task = asyncio.create_task(exit_handler())
            self._process_cleanup.append(exit_task.cancel)

            async def trigger_exit():
                logger.info(f"Exiting the process (id: {process_id})")
                future_exit(None)
                await future_exit_handler_finish
                logger.debug(f"Exited the process (id: {process_id})")

            try:
                await self._session._call(
                    self._service_name,
                    "start",
                    [
                        process_id,
                        cmd,
                        env_vars,
                        rootdir,
                    ],
                )
                logger.info(f"Started process (id: {process_id})")
                return Process(
                    output=output,
                    session=self._session,
                    process_id=process_id,
                    trigger_exit=trigger_exit,
                    finished=future_exit_handler_finish,
                )
            except RpcException as e:
                await trigger_exit()
                raise ProcessException(e.message) from e
            except TimeoutError as e:
                logger.error(f"Timeout error during starting the process: {cmd}")
                await trigger_exit()
                raise e
