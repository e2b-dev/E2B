from typing import Optional, ClassVar, Callable, List
from pydantic import BaseModel, PrivateAttr, Field
from enum import Enum

from e2b_sdk.session.out import OutStderrResponse, OutStdoutResponse
from e2b_sdk.session.env_vars import EnvVars
from e2b_sdk.session.session_connection import SessionConnection


class OpenPort(BaseModel):
    Ip: str
    Port: int
    State: str


class CodeSnippetExecState(str, Enum):
    Running = "Running"
    Stopped = "Stopped"


CodeSnippetStateHandler = Callable[[CodeSnippetExecState], None]
CodeSnippetStderrHandler = Callable[[OutStderrResponse], None]
CodeSnippetStdoutHandler = Callable[[OutStdoutResponse], None]
ScanOpenedPortsHandler = Callable[[List[OpenPort]], None]


class CodeSnippetOpts(BaseModel):
    onStateChange: Optional[CodeSnippetStateHandler] = None
    onStderr: Optional[CodeSnippetStderrHandler] = None
    onStdout: Optional[CodeSnippetStdoutHandler] = None
    onScanPorts: Optional[ScanOpenedPortsHandler] = None


class CodeSnippetManager(BaseModel):
    service_name: ClassVar[str] = Field("codeSnippet", allow_mutation=False)
    session_connection: SessionConnection = PrivateAttr()
    opts: Optional[CodeSnippetOpts]

    async def run(
        self, code: str, envVars: Optional[EnvVars] = None
    ) -> CodeSnippetExecState:
        state: CodeSnippetExecState = await self.session_connection.call(
            self.service_name, "run", [code, envVars]
        )
        if self.opts and self.opts.onStateChange:
            self.opts.onStateChange(state)
        return state

    async def stop(self) -> CodeSnippetExecState:
        state: CodeSnippetExecState = await self.session_connection.call(
            self.service_name, "stop"
        )
        if self.opts and self.opts.onStateChange:
            self.opts.onStateChange(state)
        return state

    async def _subscribe(self):
        if not self.opts:
            return self

        await self.session_connection.handle_subscriptions(
            self.session_connection.subscribe(
                self.service_name, self.opts.onStateChange, "state"
            )
            if self.opts.onStateChange
            else None,
            self.session_connection.subscribe(
                self.service_name, self.opts.onStderr, "stderr"
            )
            if self.opts.onStderr
            else None,
            self.session_connection.subscribe(
                self.service_name, self.opts.onStdout, "stdout"
            )
            if self.opts.onStdout
            else None,
            self.session_connection.subscribe(
                self.service_name, self.opts.onScanPorts, "scanOpenedPorts"
            )
            if self.opts.onScanPorts
            else None,
        )

        return self
