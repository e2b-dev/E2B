import asyncio
import logging
from typing import Any, Awaitable, Callable, Coroutine, List, Optional

import async_timeout
from e2b.constants import TIMEOUT
from e2b.session.env_vars import EnvVars
from e2b.session.exception import MultipleExceptions, RpcException, TerminalException
from e2b.session.session_connection import SessionConnection
from e2b.utils.future import DeferredFuture
from e2b.utils.id import create_id
from pydantic import BaseModel

logger = logging.getLogger(__file__)


class TerminalOutput(BaseModel):
    data = ""

    def _add_data(self, data: str) -> None:
        self.data += data


class Terminal:
    """
    Terminal session.
    """

    @property
    def data(self) -> str:
        """
        Terminal output data.
        """
        return self._output.data

    @property
    def output(self) -> TerminalOutput:
        """
        Terminal output.
        """
        return self._output

    @property
    def finished(self):
        """
        A future that is resolved when the terminal session exits.
        """
        return self._finished

    @property
    def terminal_id(self) -> str:
        """
        The terminal id used to identify the terminal in the session.
        """
        return self._terminal_id

    def __await__(self):
        return self.finished.__await__()

    def __init__(
        self,
        terminal_id: str,
        session: SessionConnection,
        trigger_exit: Callable[[], Coroutine[Any, Any, None]],
        finished: Awaitable[TerminalOutput],
        output: TerminalOutput,
    ):
        self._terminal_id = terminal_id
        self._session = session
        self._trigger_exit = trigger_exit
        self._finished = finished
        self._output = output

    async def send_data(self, data: str, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Sends data to the terminal standard input.

        :param data: Data to send
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        try:
            await self._session._call(
                TerminalManager._service_name,
                "data",
                [self.terminal_id, data],
                timeout=timeout,
            )
        except RpcException as e:
            raise TerminalException(e.message) from e

    async def resize(
        self, cols: int, rows: int, timeout: Optional[float] = TIMEOUT
    ) -> None:
        """
        Resizes the terminal tty.

        :param cols: Number of columns
        :param rows: Number of rows
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        try:
            await self._session._call(
                TerminalManager._service_name,
                "resize",
                [self.terminal_id, cols, rows],
                timeout=timeout,
            )
        except RpcException as e:
            raise TerminalException(e.message) from e

    async def kill(self, timeout: Optional[float] = TIMEOUT) -> None:
        """
        Kill the terminal session.

        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time
        """
        try:
            await self._session._call(
                TerminalManager._service_name,
                "destroy",
                [self.terminal_id],
                timeout=timeout,
            )
        except RpcException as e:
            raise TerminalException(e.message) from e
        await self._trigger_exit()


class TerminalManager:
    """
    Manager for starting and interacting with terminal sessions in the environment.
    """

    _service_name = "terminal"

    def __init__(self, session: SessionConnection):
        self._session = session
        self._process_cleanup: List[Callable[[], Any]] = []

    def _close(self):
        for cleanup in self._process_cleanup:
            cleanup()

        self._process_cleanup.clear()

    async def start(
        self,
        on_data: Callable[[str], Any],
        cols: int,
        rows: int,
        rootdir: str = "",
        terminal_id: Optional[str] = None,
        on_exit: Optional[Callable[[], Any]] = None,
        cmd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Terminal:
        """
        Start a new terminal session.

        :param on_data: Callback that will be called when the terminal sends data
        :param rootdir: Working directory where will the terminal start
        :param terminal_id: Unique identifier of the terminal session
        :param on_exit: Callback that will be called when the terminal exits
        :param cols: Number of columns the terminal will have. This affects rendering
        :param rows: Number of rows the terminal will have. This affects rendering
        :param cmd: If the `cmd` parameter is defined it will be executed as a command
        and this terminal session will exit when the command exits
        :param env_vars: Environment variables that will be accessible inside of the terminal
        :param timeout: Specify the duration, in seconds to give the method to finish its execution before it times out (default is 60 seconds). If set to None, the method will continue to wait until it completes, regardless of time

        :return: Terminal session
        """
        async with async_timeout.timeout(timeout):
            future_exit = DeferredFuture(self._process_cleanup)
            terminal_id = terminal_id or create_id(12)

            unsub_all: Optional[Callable[[], Awaitable[Any]]] = None

            output = TerminalOutput()

            def handle_data(data: str):
                output._add_data(data)
                on_data(data)

            try:
                unsub_all = await self._session._handle_subscriptions(
                    self._session._subscribe(
                        self._service_name, handle_data, "onData", terminal_id
                    ),
                    self._session._subscribe(
                        self._service_name, future_exit, "onExit", terminal_id
                    ),
                )
            except (RpcException, MultipleExceptions) as e:
                future_exit.cancel()

                if isinstance(e, RpcException):
                    raise TerminalException(e.message) from e
                elif isinstance(e, MultipleExceptions):
                    raise TerminalException(
                        "Failed to subscribe to RPC services necessary for starting terminal"
                    ) from e
            except asyncio.TimeoutError:
                future_exit.cancel()
                logger.error(f"Timeout error during starting the terminal: {cmd}")
                raise

            # TODO: Handle exit handler finish for exits (the same for processes)
            future_exit_handler_finish = DeferredFuture[TerminalOutput](
                self._process_cleanup
            )

            async def exit_handler():
                await future_exit

                if unsub_all:
                    await unsub_all()

                if on_exit:
                    on_exit()
                future_exit_handler_finish(output)

            exit_task = asyncio.create_task(exit_handler())
            self._process_cleanup.append(exit_task.cancel)

            async def trigger_exit():
                future_exit(None)
                await future_exit_handler_finish

            try:
                await self._session._call(
                    self._service_name,
                    "start",
                    [
                        terminal_id,
                        cols,
                        rows,
                        env_vars if env_vars else {},
                        cmd,
                        rootdir,
                    ],
                    timeout=timeout,
                )
                return Terminal(
                    terminal_id=terminal_id,
                    session=self._session,
                    trigger_exit=trigger_exit,
                    finished=future_exit_handler_finish,
                    output=output,
                )
            except RpcException as e:
                await trigger_exit()
                raise TerminalException(e.message) from e
            except asyncio.TimeoutError:
                logger.error(f"Timeout error during starting the terminal: {cmd}")
                await trigger_exit()
                raise
