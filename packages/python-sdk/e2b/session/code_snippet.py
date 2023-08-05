from typing import Optional, ClassVar, Callable, List
from pydantic import BaseModel, Field
from enum import Enum

from e2b.session.out import OutStderrResponse, OutStdoutResponse
from e2b.session.session_connection import SessionConnection
from e2b.session.env_vars import EnvVars


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


class CodeSnippetManager(BaseModel):
    service_name: ClassVar[str] = "codeSnippet"
    session: SessionConnection

    on_state_change: Optional[CodeSnippetStateHandler] = None
    on_stderr: Optional[CodeSnippetStderrHandler] = None
    on_stdout: Optional[CodeSnippetStdoutHandler] = None
    on_scan_ports: Optional[ScanOpenedPortsHandler] = None

    class Config:
        arbitrary_types_allowed = True

    async def run(
        self, code: str, envVars: Optional[EnvVars] = None
    ) -> CodeSnippetExecState:
        state: CodeSnippetExecState = await self.session.call(
            self.service_name, "run", [code, envVars]
        )
        if self.on_state_change:
            self.on_state_change(state)
        return state

    async def stop(self) -> CodeSnippetExecState:
        state: CodeSnippetExecState = await self.session.call(self.service_name, "stop")
        if self.on_state_change:
            self.on_state_change(state)
        return state

    async def _subscribe(self):
        await self.session.handle_subscriptions(
            self.session.subscribe(self.service_name, self.on_state_change, "state")
            if self.on_state_change
            else None,
            self.session.subscribe(self.service_name, self.on_stderr, "stderr")
            if self.on_stderr
            else None,
            self.session.subscribe(self.service_name, self.on_stdout, "stdout")
            if self.on_stdout
            else None,
            self.session.subscribe(
                self.service_name, self.on_scan_ports, "scanOpenedPorts"
            )
            if self.on_scan_ports
            else None,
        )

        return self
