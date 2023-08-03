from pydantic import BaseModel, PrivateAttr, Field
from typing import Optional, Callable, ClassVar

from e2b_sdk.session.out import OutStdoutResponse, OutStderrResponse
from e2b_sdk.session.env_vars import EnvVars
from e2b_sdk.session.session_connection import SessionConnection


class Process(BaseModel):
    process_id: str
    session_connection: SessionConnection = PrivateAttr()
    _handle_exit: Optional[Callable[[], None]] = PrivateAttr()

    async def send_stdin(self, data: str) -> None:
        pass

    async def kill(self) -> None:
        pass


class ProcessStartOpts(BaseModel):
    cmd: str
    on_stdout: Optional[Callable[[OutStdoutResponse], None]] = None
    on_stderr: Optional[Callable[[OutStderrResponse], None]] = None
    on_exit: Optional[Callable[[], None]] = None
    env_vars: Optional[EnvVars] = {}
    rootdir: str = "/"
    process_id: str = Field(None, default_factory=lambda: id(12))


class ProcessManager(BaseModel):
    _service_name: ClassVar[str] = "process"
    session_connection: SessionConnection = PrivateAttr()

    async def start(self, opts: ProcessStartOpts) -> Process:
        on_exit_sub_id, on_stdout_sub_id, on_stderr_sub_id = await self.session_connection.handle_subscriptions(
            self.session_connection.subscribe(self._service_name, opts.on_exit, "onExit", opts.process_id),
            self.session_connection.subscribe(self._service_name, opts.on_stdout, "onStdout", opts.process_id) if opts.on_stdout else None,
            self.session_connection.subscribe(self._service_name, opts.on_stderr, "onStderr", opts.process_id) if opts.on_stderr else None,
        )

        if not on_exit_sub_id or (not on_stdout_sub_id and opts.on_stdout) or (not on_stderr_sub_id and opts.on_stderr):
            raise Exception("Failed to subscribe to process service")

        # TODO: Handle process exit and unsubscribe


        try:
            await self.session_connection.call(self._service_name, "start", [
                opts.process_id,
                opts.cmd,
                opts.env_vars,
                opts.rootdir,
            ])
            return Process(session_connection=self.session_connection, process_id=opts.process_id)
        except Exception as e:
            raise

        pass

    # this.process = {
    #   start: async ({
    #     cmd,
    #     onStdout,
    #     onStderr,
    #     onExit,
    #     envVars = {},
    #     rootdir = '/',
    #     processID = id(12),
    #   }) => {
    #     const { promise: processExited, resolve: triggerExit } = createDeferredPromise()

    #     const [onExitSubID, onStdoutSubID, onStderrSubID] =
    #       await this.handleSubscriptions(
    #         this.subscribe(processService, triggerExit, 'onExit', processID),
    #         onStdout
    #           ? this.subscribe(processService, onStdout, 'onStdout', processID)
    #           : undefined,
    #         onStderr
    #           ? this.subscribe(processService, onStderr, 'onStderr', processID)
    #           : undefined,
    #       )

    #     const { promise: unsubscribing, resolve: handleFinishUnsubscribing } =
    #       createDeferredPromise()

    #     processExited.then(async () => {
    #       const results = await Promise.allSettled([
    #         this.unsubscribe(onExitSubID),
    #         onStdoutSubID ? this.unsubscribe(onStdoutSubID) : undefined,
    #         onStderrSubID ? this.unsubscribe(onStderrSubID) : undefined,
    #       ])

    #       const errMsg = formatSettledErrors(results)
    #       if (errMsg) {
    #         this.logger.error(errMsg)
    #       }

    #       onExit?.()
    #       handleFinishUnsubscribing()
    #     })

    #     try {
    #       await this.call(processService, 'start', [processID, cmd, envVars, rootdir])
    #     } catch (err) {
    #       triggerExit()
    #       await unsubscribing
    #       throw err
    #     }

    #     return {
    #       kill: async () => {
    #         try {
    #           await this.call(processService, 'kill', [processID])
    #         } finally {
    #           triggerExit()
    #           await unsubscribing
    #         }
    #       },
    #       processID,
    #       sendStdin: async data => {
    #         await this.call(processService, 'stdin', [processID, data])
    #       },
    #     }
    #   },
