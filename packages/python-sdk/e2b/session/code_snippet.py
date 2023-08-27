from typing import Any, Callable, ClassVar, List, Optional

from e2b.session.exception import MultipleExceptions, RpcException, SessionException
from e2b.session.session_connection import SessionConnection
from pydantic import BaseModel


class OpenPort(BaseModel):
    ip: str
    port: int
    state: str


ScanOpenedPortsHandler = Callable[[List[OpenPort]], Any]


class CodeSnippetManager(BaseModel):
    service_name: ClassVar[str] = "codeSnippet"
    session: SessionConnection

    on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None

    class Config:
        arbitrary_types_allowed = True

    async def _subscribe(self):
        try:
            await self.session._handle_subscriptions(
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
