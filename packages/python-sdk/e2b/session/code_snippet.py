from typing import Optional, ClassVar, Callable, List, Any
from pydantic import BaseModel
from enum import Enum

from e2b.session.exception import SessionException, MultipleExceptions
from e2b.session.out import OutStderrResponse, OutStdoutResponse
from e2b.session.session_connection import SessionConnection
from e2b.session.env_vars import EnvVars
from e2b.session.session_rpc import RpcException


class OpenPort(BaseModel):
    ip: str
    port: int
    state: str


class CodeSnippetExecState(str, Enum):
    Running = "Running"
    Stopped = "Stopped"


CodeSnippetStateHandler = Callable[[CodeSnippetExecState], None]
CodeSnippetStderrHandler = Callable[[OutStderrResponse], None]
CodeSnippetStdoutHandler = Callable[[OutStdoutResponse], None]
ScanOpenedPortsHandler = Callable[[List[OpenPort]], Any]


class CodeSnippetManager(BaseModel):
    service_name: ClassVar[str] = "codeSnippet"
    session: SessionConnection

    on_state_change: Optional[CodeSnippetStateHandler] = None
    on_stderr: Optional[CodeSnippetStderrHandler] = None
    on_stdout: Optional[CodeSnippetStdoutHandler] = None
    on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None

    class Config:
        arbitrary_types_allowed = True

    async def run(
        self, code: str, envVars: Optional[EnvVars] = None
    ) -> CodeSnippetExecState:
        state: CodeSnippetExecState = await self.session._call(
            self.service_name, "run", [code, envVars]
        )
        if self.on_state_change:
            self.on_state_change(state)
        return state

    async def stop(self) -> CodeSnippetExecState:
        state: CodeSnippetExecState = await self.session._call(
            self.service_name, "stop"
        )
        if self.on_state_change:
            self.on_state_change(state)
        return state

    async def _subscribe(self):
        try:
            await self.session._handle_subscriptions(
                self.session._subscribe(
                    self.service_name, self.on_state_change, "state"
                )
                if self.on_state_change
                else None,
                self.session._subscribe(self.service_name, self.on_stderr, "stderr")
                if self.on_stderr
                else None,
                self.session._subscribe(self.service_name, self.on_stdout, "stdout")
                if self.on_stdout
                else None,
                self.session._subscribe(
                    self.service_name,
                    lambda ports: self.on_scan_ports(
                        [
                            OpenPort(
                                ip=port["Ip"],
                                port=port["Port"],
                                state=port["State"],
                            )
                            for port in ports
                        ]
                    )
                    if self.on_scan_ports
                    else None,
                    "scanOpenedPorts",
                )
                if self.on_scan_ports
                else None,
            )
        except RpcException as e:
            raise SessionException(e.message) from e
        except MultipleExceptions as e:
            raise SessionException("Failed to subscribe to RPC services") from e

        return self
