import asyncio

from pydantic import BaseModel, Field
from typing import Awaitable, Optional, Callable, ClassVar, Any, Coroutine

from e2b.utils.noop import noop
from e2b.session.out import OutStdoutResponse, OutStderrResponse
from e2b.utils.future import DeferredFuture
from e2b.session.env_vars import EnvVars
from e2b.session.session_connection import SessionConnection
from e2b.utils.id import create_id


class Process:
    def __init__(
        self,
        process_id: str,
        session: SessionConnection,
        trigger_exit: Callable[[], Coroutine[Any, Any, None]],
        finished: Awaitable,
    ):
        self.process_id = process_id
        self._session = session
        self._trigger_exit = trigger_exit
        self.finished = finished

    async def send_stdin(self, data: str) -> None:
        await self._session.call(
            ProcessManager.service_name, "stdin", [self.process_id, data]
        )

    async def kill(self) -> None:
        await self._session.call(ProcessManager.service_name, "kill", [self.process_id])
        await self._trigger_exit()


class ProcessManager(BaseModel):
    service_name: ClassVar[str] = "process"
    session: SessionConnection

    class Config:
        arbitrary_types_allowed = True

    async def start(
        self,
        cmd: str,
        on_stdout: Optional[Callable[[OutStdoutResponse], None]] = None,
        on_stderr: Optional[Callable[[OutStderrResponse], None]] = None,
        on_exit: Optional[Callable[[], None]] = None,
        env_vars: Optional[EnvVars] = {},
        rootdir: str = "/",
        process_id: str | None = None,
    ) -> Process:
        future_exit = DeferredFuture()
        process_id = process_id or create_id(12)

        (
            on_exit_sub_id,
            on_stdout_sub_id,
            on_stderr_sub_id,
        ) = await self.session.handle_subscriptions(
            self.session.subscribe(
                self.service_name, future_exit, "onExit", process_id
            ),
            self.session.subscribe(self.service_name, on_stdout, "onStdout", process_id)
            if on_stdout
            else None,
            self.session.subscribe(self.service_name, on_stderr, "onStderr", process_id)
            if on_stderr
            else None,
        )

        future_exit_handler_finish = DeferredFuture()

        async def exit_handler():
            await future_exit
            await asyncio.gather(
                self.session.unsubscribe(on_exit_sub_id) if on_exit_sub_id else noop(),
                self.session.unsubscribe(on_stdout_sub_id)
                if on_stdout_sub_id
                else noop(),
                self.session.unsubscribe(on_stderr_sub_id)
                if on_stderr_sub_id
                else noop(),
                return_exceptions=True,
            )
            if on_exit:
                on_exit()
            future_exit_handler_finish(None)

        asyncio.create_task(exit_handler())

        async def trigger_exit():
            future_exit(None)
            await future_exit_handler_finish.future

        if (
            not on_exit_sub_id
            or (not on_stdout_sub_id and on_stdout)
            or (not on_stderr_sub_id and on_stderr)
        ):
            await trigger_exit()
            raise Exception("Failed to subscribe to process service")

        try:
            await self.session.call(
                self.service_name,
                "start",
                [
                    process_id,
                    cmd,
                    env_vars,
                    rootdir,
                ],
            )
            return Process(
                session=self.session,
                process_id=process_id,
                trigger_exit=trigger_exit,
                finished=future_exit_handler_finish,
            )
        except:
            await trigger_exit()
            raise
