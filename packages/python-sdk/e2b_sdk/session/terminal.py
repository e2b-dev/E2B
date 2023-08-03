from typing import ClassVar, Callable, Optional
from pydantic import BaseModel, Field, PrivateAttr

from e2b_sdk.session.session_connection import SessionConnection
from e2b_sdk.session.env_vars import EnvVars

class TerminalSize(BaseModel):
    cols: int
    rows: int


class TerminalSession(BaseModel):
    terminal_id: str

    async def send_data(self, data: str) -> None:
        pass

    async def resize(self, size: TerminalSize) -> None:
        pass

    async def destroy(self) -> None:
        pass


class TerminalSessionOpts(BaseModel):
    on_data: Callable[[str], None]
    on_exit: Optional[Callable[[], None]] = None
    size: TerminalSize
    terminal_id: Optional[str] = Field(None, default_factory=lambda: id(12))
    cmd: Optional[str] = None
    """
    If the `cmd` parameter is defined it will be executed as a command
    and this terminal session will exit when the command exits.
    """
    rootdir: Optional[str] = None
    """
    Working directory where will the terminal start.
    """
    env_vars: Optional[EnvVars] = None
    """
    Environment variables that will be accessible inside of the terminal.
    """


class TerminalManager(BaseModel):
    _service_name: ClassVar[str] = "terminal"

    session_connection: SessionConnection = PrivateAttr()

    async def create_session(self, opts: TerminalSessionOpts) -> TerminalSession:
        on_data_sub_id, on_exit_sub_id = await self.session_connection.handle_subscriptions(
            self.session_connection.subscribe(self._service_name, opts.on_data, "onData", opts.terminal_id),
            self.session_connection.subscribe(self._service_name, opts.on_exit, "onExit", opts.terminal_id),
        )

        if not on_data_sub_id or not on_exit_sub_id:
            raise Exception("Failed to subscribe to terminal service")

        

        pass


    # // Init Terminal handler
    # this.terminal = {
    #   createSession: async ({
    #     onData,
    #     size,
    #     onExit,
    #     envVars,
    #     cmd,
    #     rootdir,
    #     terminalID = id(12),
    #   }) => {
    #     const { promise: terminalExited, resolve: triggerExit } = createDeferredPromise()

    #     const [onDataSubID, onExitSubID] = await this.handleSubscriptions(
    #       this.subscribe(terminalService, onData, 'onData', terminalID),
    #       this.subscribe(terminalService, triggerExit, 'onExit', terminalID),
    #     )

    #     const { promise: unsubscribing, resolve: handleFinishUnsubscribing } =
    #       createDeferredPromise()

    #     terminalExited.then(async () => {
    #       const results = await Promise.allSettled([
    #         this.unsubscribe(onExitSubID),
    #         this.unsubscribe(onDataSubID),
    #       ])

    #       const errMsg = formatSettledErrors(results)
    #       if (errMsg) {
    #         this.logger.error(errMsg)
    #       }

    #       onExit?.()
    #       handleFinishUnsubscribing()
    #     })

    #     try {
    #       await this.call(terminalService, 'start', [
    #         terminalID,
    #         size.cols,
    #         size.rows,
    #         // Handle optional args for old devbookd compatibility
    #         ...(cmd !== undefined ? [envVars, cmd, rootdir] : []),
    #       ])
    #     } catch (err) {
    #       triggerExit()
    #       await unsubscribing
    #       throw err
    #     }

    #     return {
    #       destroy: async () => {
    #         try {
    #           await this.call(terminalService, 'destroy', [terminalID])
    #         } finally {
    #           triggerExit()
    #           await unsubscribing
    #         }
    #       },
    #       resize: async ({ cols, rows }) => {
    #         await this.call(terminalService, 'resize', [terminalID, cols, rows])
    #       },
    #       sendData: async data => {
    #         await this.call(terminalService, 'data', [terminalID, data])
    #       },
    #       terminalID,
    #     }
    #   },
    # }
