import asyncio

from typing import ClassVar, Callable, Optional, Coroutine, Any
from pydantic import BaseModel, Field

from e2b.utils.noop import noop
from e2b.utils.future import DeferredFuture
from e2b.session.env_vars import EnvVars
from e2b.session.session_connection import SessionConnection


class TerminalSession(BaseModel):
    terminal_id: str

    session: SessionConnection
    _trigger_exit: Callable[[], Coroutine[Any, Any, None]]

    class Config:
        arbitrary_types_allowed = True

    async def send_data(self, data: str) -> None:
        await self.session.call(
            TerminalManager.service_name, "data", [self.terminal_id, data]
        )

    async def resize(self, cols: int, rows: int) -> None:
        await self.session.call(
            TerminalManager.service_name,
            "resize",
            [self.terminal_id, cols, rows],
        )

    async def destroy(self) -> None:
        await self.session.call(
            TerminalManager.service_name, "destroy", [self.terminal_id]
        )
        await self._trigger_exit()


class TerminalManager(BaseModel):
    service_name: ClassVar[str] = "terminal"
    session: SessionConnection

    class Config:
        arbitrary_types_allowed = True

    async def create_session(
        self,
        on_data: Callable[[str], None],
        cols: int,
        rows: int,
        rootdir: str,
        terminal_id: str = Field(default_factory=lambda: id(12)),
        on_exit: Optional[Callable[[], None]] = None,
        cmd: Optional[str] = None,
        env_vars: Optional[EnvVars] = None,
    ) -> TerminalSession:
        """
        Creates a new terminal session.

        :param on_data: Callback that will be called when the terminal sends data.
        :param size: Initial size of the terminal.
        :param rootdir: Working directory where will the terminal start.
        :param terminal_id: Unique identifier of the terminal session.
        :param on_exit: Callback that will be called when the terminal exits.
        :param cmd: If the `cmd` parameter is defined it will be executed as a command
        and this terminal session will exit when the command exits.
        :param env_vars: Environment variables that will be accessible inside of the terminal.
        :return: Terminal session.
        """
        future_exit = DeferredFuture()

        (
            on_data_sub_id,
            on_exit_sub_id,
        ) = await self.session.handle_subscriptions(
            self.session.subscribe(self.service_name, on_data, "onData", terminal_id),
            self.session.subscribe(
                self.service_name, future_exit, "onExit", terminal_id
            ),
        )

        future_exit_handler_finish = DeferredFuture()

        async def exit_handler():
            await future_exit
            await asyncio.gather(
                self.session.unsubscribe(on_data_sub_id) if on_data_sub_id else noop(),
                self.session.unsubscribe(on_exit_sub_id) if on_exit_sub_id else noop(),
                return_exceptions=True,
            )
            if on_exit:
                on_exit()
            future_exit_handler_finish(None)

        asyncio.create_task(exit_handler())

        async def trigger_exit():
            future_exit(None)
            await future_exit_handler_finish

        if not on_data_sub_id or not on_exit_sub_id:
            await trigger_exit()
            raise Exception("Failed to subscribe to terminal service")

        try:
            await self.session.call(
                self.service_name,
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
                session=self.session,
                _trigger_exit=trigger_exit,
            )
        except:
            await trigger_exit()
            raise
