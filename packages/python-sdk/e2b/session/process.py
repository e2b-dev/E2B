import asyncio
import logging
import warnings
from abc import ABC
from asyncio.exceptions import TimeoutError
from typing import (
    Any,
    Awaitable,
    Callable,
    ClassVar,
    Coroutine,
    Dict,
    List,
    Optional,
    Union,
    Type,
)

import async_timeout
from pydantic import BaseModel

from e2b.constants import TIMEOUT
from e2b.session.env_vars import EnvVars
from e2b.session.exception import MultipleExceptions, ProcessException, RpcException
from e2b.session.out import OutStderrResponse, OutStdoutResponse
from e2b.session.session_connection import SessionConnection
from e2b.utils.future import DeferredFuture
from e2b.utils.id import create_id

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

    error: bool = False
    exit_code: Optional[int] = None

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

    @property
    def exit_code(self) -> int:
        """
        The exit code of the last process started by this manager.
        """
        if not self.finished:
            raise ProcessException("Process has not finished yet")
        return self.output.exit_code

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
        """
        Deprecated, use wait instead.
        """
        warnings.warn(
            "Use wait instead of just calling await on Process", DeprecationWarning
        )
        return self._finished.__await__()

    async def wait(self):
        """
        Waits for the process to exit.
        """
        return await self._finished

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


class SyncProcess(Process):
    @property
    def _loop(self):
        return self._session._loop

    def wait(self):
        """
        Waits for the process to exit.
        """
        return self._loop.run_until_complete(super().wait())

    def send_stdin(self, data: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Sends data to the process stdin.

        :param data: Data to send
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        return self._loop.run_until_complete(super().send_stdin(data, timeout))

    def kill(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Kills the process.

        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        return self._loop.run_until_complete(super().kill(timeout))


class BaseProcessManager(ABC):
    """
    Manager for starting and interacting with processes in the environment.
    """

    _service_name = "process"
    _process_model: Union[Type[Process], Type[SyncProcess]]

    def __init__(
        self,
        session: SessionConnection,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[], Any]] = None,
    ):
        self._session = session
        self._process_cleanup: List[Callable[[], Any]] = []
        self._on_stdout = on_stdout
        self._on_stderr = on_stderr
        self._on_exit = on_exit

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
        cwd: str = "",
        rootdir: str = "",  # DEPRECATED
        process_id: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Union[Process, SyncProcess]:
        logger.info(f"Starting process (id: {process_id}): {cmd}")
        async with async_timeout.timeout(timeout):
            env_vars = env_vars or {}
            env_vars = {**self._session.env_vars, **env_vars}

            on_stdout = on_stdout or self._on_stdout
            on_stderr = on_stderr or self._on_stderr
            on_exit = on_exit or self._on_exit

            future_exit = DeferredFuture(self._process_cleanup)
            process_id = process_id or create_id(12)

            unsub_all: Optional[Callable[[], Awaitable[Any]]] = None

            output = ProcessOutput()

            def handle_exit(exit_code: int):
                output.exit_code = exit_code
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
                unsub_all = await self._session._handle_subscriptions(
                    self._session._subscribe(
                        self._service_name, handle_exit, "onExit", process_id
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
                if not cwd and rootdir:
                    cwd = rootdir
                    logger.warning(
                        "The rootdir parameter is deprecated, use cwd instead."
                    )

                if not cwd and self._session.cwd:
                    cwd = self._session.cwd

                await self._session._call(
                    self._service_name,
                    "start",
                    [
                        process_id,
                        cmd,
                        env_vars,
                        cwd,
                    ],
                )
                logger.info(f"Started process (id: {process_id})")
                return self._process_model(
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


class ProcessManager(BaseProcessManager):
    _process_model = Process

    async def start(
        self,
        cmd: str,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[], Any]] = None,
        env_vars: Optional[EnvVars] = None,
        cwd: str = "",
        rootdir: str = "",  # DEPRECATED
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
        :param cwd: The root directory for the process
        :param rootdir: (DEPRECATED - use cwd) The root directory for the process
        .. deprecated:: 0.3.2
            Use cwd instead.
        :param process_id: The process id to use for the process. If not provided, a random id is generated
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time

        :return: A process object
        """
        return await super().start(
            cmd=cmd,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
            env_vars=env_vars,
            cwd=cwd,
            rootdir=rootdir,
            process_id=process_id,
            timeout=timeout,
        )


class SyncProcessManager(BaseProcessManager):
    _process_model = SyncProcess

    def __init__(
        self,
        session: SessionConnection,
        loop: asyncio.AbstractEventLoop,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[], Any]] = None,
    ):
        super().__init__(
            session=session,
            on_stdout=on_stdout,
            on_stderr=on_stderr,
            on_exit=on_exit,
        )
        self._loop = loop

    def start(
        self,
        cmd: str,
        on_stdout: Optional[Callable[[ProcessMessage], Any]] = None,
        on_stderr: Optional[Callable[[ProcessMessage], Any]] = None,
        on_exit: Optional[Callable[[], Any]] = None,
        env_vars: Optional[EnvVars] = None,
        cwd: str = "",
        rootdir: str = "",  # DEPRECATED
        process_id: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> SyncProcess:
        """
        Starts a process in the environment.

        :param cmd: The command to run
        :param on_stdout: A callback that is called when stdout with a newline is received from the process
        :param on_stderr: A callback that is called when stderr with a newline is received from the process
        :param on_exit: A callback that is called when the process exits
        :param env_vars: A dictionary of environment variables to set for the process
        :param cwd: The root directory for the process
        :param rootdir: (DEPRECATED - use cwd) The root directory for the process
        .. deprecated:: 0.3.2
            Use cwd instead.
        :param process_id: The process id to use for the process. If not provided, a random id is generated
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time

        :return: A process object
        """
        return self._loop.run_until_complete(
            super().start(
                cmd=cmd,
                on_stdout=on_stdout,
                on_stderr=on_stderr,
                on_exit=on_exit,
                env_vars=env_vars,
                cwd=cwd,
                rootdir=rootdir,
                process_id=process_id,
                timeout=timeout,
            )
        )
