import logging

from typing import Optional, Dict
from e2b.envd import EnvdApiClient
from e2b.sandbox.filesystem import Filesystem
from e2b.sandbox.process import Process

from e2b.sandbox.sandbox_api import SandboxApi
from e2b.connection_config import ConnectionConfig

logger = logging.getLogger(__name__)

# TODO: Add requestTimeout
# TODO: Add logging (interceptors?)


class Sandbox(SandboxApi):
    _envd_port = 49982

    def __init__(
        self,
        template: str = "base-v1",
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        sandbox_id: Optional[str] = None,
        request_timeout: Optional[float] = None,
    ):
        super().__init__()

        self._connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if sandbox_id is None:
            self.sandbox_id = SandboxApi._create_sandbox(
                template=template,
                api_key=api_key,
                timeout=timeout,
                metadata=metadata,
                domain=domain,
                debug=debug,
                request_timeout=request_timeout,
            )
        else:
            self.sandbox_id = sandbox_id

        sandbox_server_url = (
            f"{'http' if debug else 'https'}://{self.get_host(self._envd_port)}"
        )

        envd_api_client = EnvdApiClient(api_url=sandbox_server_url)

        self.filesystem = Filesystem(sandbox_server_url, envd_api_client)
        self.process = Process(sandbox_server_url)

    def get_host(self, port: int) -> str:
        if self._connection_config.debug:
            return f"localhost:{port}"

        return f"{port}-{self.sandbox_id}.{self._connection_config.domain}"

    @classmethod
    def connect(
        cls,
        sandbox_id: str,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
    ):
        return cls(
            sandbox_id=sandbox_id,
            api_key=api_key,
            domain=domain,
            debug=debug,
        )

    def set_timeout(
        self,
        timeout: int,
        request_timeout: Optional[float] = None,
    ) -> None:
        # TODO: Ensure the ** works

        SandboxApi.set_timeout(
            sandbox_id=self.sandbox_id,
            timeout=timeout,
            **self._connection_config.__dict__,
            request_timeout=request_timeout,
        )

    def kill(self, request_timeout: Optional[float] = None) -> None:
        SandboxApi.kill(
            sandbox_id=self.sandbox_id,
            **self._connection_config.__dict__,
            request_timeout=request_timeout,
        )

    def upload_url(self) -> str:
        host = self.get_host(self._envd_port)

        # TODO: Finish url

        return f"{'http' if self._connection_config.debug else 'https'}://{host}/files"
