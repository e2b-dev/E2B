import asyncio
import logging

from typing import Awaitable, Optional, Callable, Any, Coroutine, List

from e2b.utils.noop import noop
from e2b.session.out import OutStdoutResponse, OutStderrResponse
from e2b.utils.future import DeferredFuture
from e2b.session.env_vars import EnvVars
from e2b.session.session_connection import SessionConnection
from e2b.utils.id import create_id
from e2b.session.session_rpc import RpcException
from e2b.session.exception import ProcessException, MultipleExceptions


logger = logging.getLogger(__name__)


class Process:
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
        return self.finished.__await__()

    def __init__(
        self,
        process_id: str,
        session: SessionConnection,
        trigger_exit: Callable[[], Coroutine[Any, Any, None]],
        finished: Awaitable[None],
    ):
        self._process_id = process_id
        self._session = session
        self._trigger_exit = trigger_exit
        self._finished = finished

    async def send_stdin(self, data: str) -> None:
        """
        Sends data to the process stdin.

        :param data: Data to send
        """
        try:
            await self._session._call(
                ProcessManager._service_name, "stdin", [self.process_id, data]
            )
        except RpcException as e:
            raise ProcessException(e.message) from e

    async def kill(self) -> None:
        """
        Kills the process.
        """
        try:
            await self._session._call(
                ProcessManager._service_name, "kill", [self.process_id]
            )
        except RpcException as e:
            raise ProcessException(e.message) from e
        await self._trigger_exit()


class ProcessManager:
    _service_name = "process"

    def __init__(self, session: SessionConnection):
        self._session = session
        self._process_cleanup: List[Callable[[], Any]] = []

    def __del__(self):
        self._close()

    def _close(self):
        for cleanup in self._process_cleanup:
            cleanup()

        self._process_cleanup.clear()

    async def start(
        self,
        cmd: str,
        on_stdout: Optional[Callable[[OutStdoutResponse], Any]] = None,
        on_stderr: Optional[Callable[[OutStderrResponse], Any]] = None,
        on_exit: Optional[Callable[[], Any]] = None,
        env_vars: Optional[EnvVars] = {},
        rootdir: str = "/",
        process_id: str | None = None,
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

        :return: A process object.
        """

        future_exit = DeferredFuture(self._process_cleanup)
        process_id = process_id or create_id(12)

        unsub_all: Optional[Callable[[], Awaitable[Any]]] = None

        try:
            unsub_all = await self._session._handle_subscriptions(
                self._session._subscribe(
                    self._service_name, future_exit, "onExit", process_id
                ),
                self._session._subscribe(
                    self._service_name, on_stdout, "onStdout", process_id
                )
                if on_stdout
                else None,
                self._session._subscribe(
                    self._service_name, on_stderr, "onStderr", process_id
                )
                if on_stderr
                else None,
            )
        except (RpcException, MultipleExceptions) as e:
            future_exit.cancel()

            if isinstance(e, RpcException):
                raise ProcessException(e.message) from e
            elif isinstance(e, MultipleExceptions):
                raise ProcessException(
                    "Failed to subscribe to RPC services necessary for starting process"
                ) from e

        future_exit_handler_finish = DeferredFuture(self._process_cleanup)

        async def exit_handler():
            await future_exit
            logger.info(
                f"Handling process exit {process_id} - {future_exit.future.done()}",
            )
            if unsub_all:
                await unsub_all()
            if on_exit:
                on_exit()
            future_exit_handler_finish(None)

        exit_task = asyncio.create_task(exit_handler())
        self._process_cleanup.append(exit_task.cancel)

        async def trigger_exit():
            logger.info("Triggering exit")
            future_exit(None)
            await future_exit_handler_finish

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
            return Process(
                session=self._session,
                process_id=process_id,
                trigger_exit=trigger_exit,
                finished=future_exit_handler_finish,
            )
        except RpcException as e:
            await trigger_exit()
            raise ProcessException(e.message) from e
