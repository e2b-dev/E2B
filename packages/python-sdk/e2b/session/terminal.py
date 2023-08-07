import asyncio

from typing import Awaitable, Callable, Optional, Coroutine, Any, List

from e2b.utils.noop import noop
from e2b.utils.future import DeferredFuture
from e2b.session.env_vars import EnvVars
from e2b.session.session_connection import SessionConnection
from e2b.utils.id import create_id


class TerminalSession:
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
        finished: Awaitable[None],
    ):
        self._terminal_id = terminal_id
        self._session = session
        self._trigger_exit = trigger_exit
        self._finished = finished

    async def send_data(self, data: str) -> None:
        """
        Sends data to the terminal standard input.

        :param data: Data to send
        """
        await self._session._call(
            TerminalManager._service_name,
            "data",
            [self.terminal_id, data],
        )

    async def resize(self, cols: int, rows: int) -> None:
        """
        Resizes the terminal tty.

        :param cols: Number of columns
        :param rows: Number of rows
        """
        await self._session._call(
            TerminalManager._service_name,
            "resize",
            [self.terminal_id, cols, rows],
        )

    async def kill(self) -> None:
        """
        Kill the terminal session.
        """
        await self._session._call(
            TerminalManager._service_name, "destroy", [self.terminal_id]
        )
        await self._trigger_exit()


class TerminalManager:
    _service_name = "terminal"

    def __init__(self, session: SessionConnection):
        self._session = session
        self._process_cleanup: List[Callable[[], Any]] = []

    def __del__(self):
        print("DELETING")
        self._close()

    def _close(self):
        for cleanup in self._process_cleanup:
            cleanup()

        self._process_cleanup.clear()

    async def start(
        self,
        on_data: Callable[[str], Any],
        cols: int,
        rows: int,
        rootdir: str,
        terminal_id: str | None = None,
        on_exit: Optional[Callable[[], Any]] = None,
        cmd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
    ) -> TerminalSession:
        """
        Start a new terminal session.

        :param on_data: Callback that will be called when the terminal sends data
        :param size: Initial size of the terminal
        :param rootdir: Working directory where will the terminal start
        :param terminal_id: Unique identifier of the terminal session
        :param on_exit: Callback that will be called when the terminal exits
        :param cols: Number of columns the terminal will have. This affects rendering
        :param rows: Number of rows the terminal will have. This affects rendering
        :param cmd: If the `cmd` parameter is defined it will be executed as a command
        and this terminal session will exit when the command exits
        :param env_vars: Environment variables that will be accessible inside of the terminal

        :return: Terminal session
        """
        future_exit = DeferredFuture(self._process_cleanup)
        terminal_id = terminal_id or create_id(12)

        (
            on_data_sub_id,
            on_exit_sub_id,
        ) = await self._session._handle_subscriptions(
            [
                self._session._subscribe(
                    self._service_name, on_data, "onData", terminal_id
                ),
                self._session._subscribe(
                    self._service_name, future_exit, "onExit", terminal_id
                ),
            ],
        )

        future_exit_handler_finish = DeferredFuture(self._process_cleanup)

        async def exit_handler():
            await future_exit
            await asyncio.gather(
                self._session._unsubscribe(on_data_sub_id)
                if on_data_sub_id
                else noop(),
                self._session._unsubscribe(on_exit_sub_id)
                if on_exit_sub_id
                else noop(),
                return_exceptions=True,
            )
            if on_exit:
                on_exit()
            future_exit_handler_finish(None)

        exit_task = asyncio.create_task(exit_handler())
        self._process_cleanup.append(exit_task.cancel)

        async def trigger_exit():
            future_exit(None)
            await future_exit_handler_finish

        if not on_data_sub_id or not on_exit_sub_id:
            await trigger_exit()
            raise Exception("Failed to subscribe to terminal service")

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
            )
            return TerminalSession(
                terminal_id=terminal_id,
                session=self._session,
                trigger_exit=trigger_exit,
                finished=future_exit,
            )
        except:
            await trigger_exit()
            raise
