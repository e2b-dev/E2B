import asyncio

from pydantic import BaseModel, PrivateAttr, Field
from typing import Optional, Callable, ClassVar, Any, Coroutine

from e2b_sdk.utils.noop import noop
from e2b_sdk.session.out import OutStdoutResponse, OutStderrResponse
from e2b_sdk.utils.future import DeferredFuture
from e2b_sdk.session.env_vars import EnvVars
from e2b_sdk.session.session_connection import SessionConnection


class Process(BaseModel):
    process_id: str
    session_connection: SessionConnection = PrivateAttr()
    trigger_exit: Callable[[], Coroutine[Any, Any, None]] = PrivateAttr()

    async def send_stdin(self, data: str) -> None:
        await self.session_connection.call(
            ProcessManager.service_name, "stdin", [self.process_id, data]
        )

    async def kill(self) -> None:
        await self.session_connection.call(
            ProcessManager.service_name, "kill", [self.process_id]
        )
        await self.trigger_exit()


class ProcessStartOpts(BaseModel):
    cmd: str
    on_stdout: Optional[Callable[[OutStdoutResponse], None]] = None
    on_stderr: Optional[Callable[[OutStderrResponse], None]] = None
    on_exit: Optional[Callable[[], None]] = None
    env_vars: Optional[EnvVars] = {}
    rootdir: str = "/"
    process_id: str = Field(None, default_factory=lambda: id(12))


class ProcessManager(BaseModel):
    service_name: ClassVar[str] = Field("process", allow_mutation=False)
    session_connection: SessionConnection = PrivateAttr()

    async def start(self, opts: ProcessStartOpts) -> Process:
        future_exit = DeferredFuture()

        (
            on_exit_sub_id,
            on_stdout_sub_id,
            on_stderr_sub_id,
        ) = await self.session_connection.handle_subscriptions(
            self.session_connection.subscribe(
                self.service_name, future_exit, "onExit", opts.process_id
            ),
            self.session_connection.subscribe(
                self.service_name, opts.on_stdout, "onStdout", opts.process_id
            )
            if opts.on_stdout
            else None,
            self.session_connection.subscribe(
                self.service_name, opts.on_stderr, "onStderr", opts.process_id
            )
            if opts.on_stderr
            else None,
        )

        future_exit_handler_finish = DeferredFuture()

        async def exit_handler():
            await future_exit
            await asyncio.gather(
                self.session_connection.unsubscribe(on_exit_sub_id)
                if on_exit_sub_id
                else noop(),
                self.session_connection.unsubscribe(on_stdout_sub_id)
                if on_stdout_sub_id
                else noop(),
                self.session_connection.unsubscribe(on_stderr_sub_id)
                if on_stderr_sub_id
                else noop(),
                return_exceptions=True,
            )
            if opts.on_exit:
                opts.on_exit()
            future_exit_handler_finish(None)

        asyncio.create_task(exit_handler())

        async def trigger_exit():
            future_exit(None)
            await future_exit_handler_finish

        if (
            not on_exit_sub_id
            or (not on_stdout_sub_id and opts.on_stdout)
            or (not on_stderr_sub_id and opts.on_stderr)
        ):
            await trigger_exit()
            raise Exception("Failed to subscribe to process service")

        try:
            await self.session_connection.call(
                self.service_name,
                "start",
                [
                    opts.process_id,
                    opts.cmd,
                    opts.env_vars,
                    opts.rootdir,
                ],
            )
            return Process(
                session_connection=self.session_connection,
                process_id=opts.process_id,
                trigger_exit=trigger_exit,
            )
        except:
            await trigger_exit()
            raise
