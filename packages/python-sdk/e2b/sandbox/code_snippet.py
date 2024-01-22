from typing import Any, Callable, ClassVar, List, Optional
from pydantic import BaseModel

from e2b.sandbox.exception import MultipleExceptions, RpcException, SandboxException
from e2b.sandbox.sandbox_connection import SandboxConnection, SubscriptionArgs


class OpenPort(BaseModel):
    ip: str
    port: int
    state: str


ScanOpenedPortsHandler = Callable[[List[OpenPort]], Any]


class CodeSnippetManager(BaseModel):
    # TODO: Change to model_config = ConfigDict(arbitrary_types_allowed=True) when only pydantic 2.0 is used
    class Config:
        arbitrary_types_allowed = True

    service_name: ClassVar[str] = "codeSnippet"
    sandbox: SandboxConnection

    on_scan_ports: Optional[Callable[[List[OpenPort]], Any]] = None

    def _subscribe(self):
        def on_scan_ports(ports: List[dict]):
            ports = [
                OpenPort(
                    ip=port["Ip"],
                    port=port["Port"],
                    state=port["State"],
                )
                for port in ports
            ]
            if self.on_scan_ports:
                self.on_scan_ports(ports)

        try:
            self.sandbox._handle_subscriptions(
                SubscriptionArgs(
                    service=self.service_name,
                    handler=on_scan_ports,
                    method="scanOpenedPorts",
                )
            )
        except RpcException as e:
            raise SandboxException(e.message) from e
        except MultipleExceptions as e:
            raise SandboxException("Failed to subscribe to RPC services") from e

        return self
