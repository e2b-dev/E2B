import asyncio

from typing import ClassVar, Callable, Optional, Coroutine, Any
from pydantic import BaseModel, Field, PrivateAttr

from e2b_sdk.utils.noop import noop
from e2b_sdk.utils.future import DeferredFuture
from e2b_sdk.session.session_connection import SessionConnection
from e2b_sdk.session.env_vars import EnvVars


class TerminalSize(BaseModel):
    cols: int
    rows: int


class TerminalSession(BaseModel):
    terminal_id: str
    session_connection: SessionConnection = PrivateAttr()
    trigger_exit: Callable[[], Coroutine[Any, Any, None]] = PrivateAttr()

    async def send_data(self, data: str) -> None:
        await self.session_connection.call(
            TerminalManager.service_name, "data", [self.terminal_id, data]
        )

    async def resize(self, size: TerminalSize) -> None:
        await self.session_connection.call(
            TerminalManager.service_name,
            "resize",
            [self.terminal_id, size.cols, size.rows],
        )

    async def destroy(self) -> None:
        await self.session_connection.call(
            TerminalManager.service_name, "destroy", [self.terminal_id]
        )
        await self.trigger_exit()


class TerminalSessionOpts(BaseModel):
    on_data: Callable[[str], None]
    on_exit: Optional[Callable[[], None]] = None
    size: TerminalSize
    terminal_id: str = Field(None, default_factory=lambda: id(12))
    cmd: Optional[str] = None
    """
    If the `cmd` parameter is defined it will be executed as a command
    and this terminal session will exit when the command exits.
    """
    rootdir: str
    """
    Working directory where will the terminal start.
    """
    env_vars: Optional[EnvVars] = None
    """
    Environment variables that will be accessible inside of the terminal.
    """


class TerminalManager(BaseModel):
    service_name: ClassVar[str] = Field("terminal", allow_mutation=False)

    session_connection: SessionConnection = PrivateAttr()

    async def create_session(self, opts: TerminalSessionOpts) -> TerminalSession:
        future_exit = DeferredFuture()

        (
            on_data_sub_id,
            on_exit_sub_id,
        ) = await self.session_connection.handle_subscriptions(
            self.session_connection.subscribe(
                self.service_name, opts.on_data, "onData", opts.terminal_id
            ),
            self.session_connection.subscribe(
                self.service_name, future_exit.resolve, "onExit", opts.terminal_id
            ),
        )

        future_exit_handler_finish = DeferredFuture()

        async def exit_handler():
            await future_exit
            await asyncio.gather(
                self.session_connection.unsubscribe(on_data_sub_id)
                if on_data_sub_id
                else noop(),
                self.session_connection.unsubscribe(on_exit_sub_id)
                if on_exit_sub_id
                else noop(),
                return_exceptions=True,
            )
            if opts.on_exit:
                opts.on_exit()
            future_exit_handler_finish.resolve()

        asyncio.create_task(exit_handler())

        async def trigger_exit():
            future_exit.resolve()
            await future_exit_handler_finish

        if not on_data_sub_id or not on_exit_sub_id:
            await trigger_exit()
            raise Exception("Failed to subscribe to terminal service")

        try:
            await self.session_connection.call(
                self.service_name,
                "start",
                [
                    opts.terminal_id,
                    opts.size.cols,
                    opts.size.rows,
                    opts.env_vars if opts.env_vars else {},
                    opts.cmd,
                    opts.rootdir,
                ],
            )
            return TerminalSession(
                terminal_id=opts.terminal_id,
                session_connection=self.session_connection,
                trigger_exit=trigger_exit,
            )
        except:
            await trigger_exit()
            raise
