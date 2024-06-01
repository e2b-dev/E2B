import logging

from typing import Optional, Dict
from e2b.sandbox.filesystem import Filesystem
from e2b.sandbox.process import Process

from e2b.sandbox.sandbox_api import SandboxApi
from e2b.sandbox.sandbox_files import SandboxFiles
from e2b.connection_config import ConnectionConfig

logger = logging.getLogger(__name__)

SANDBOX_SERVER_PORT = 49982


class Sandbox(SandboxApi):
    def __init__(
        self,
        template: str = "base",
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        sandbox_id: Optional[str] = None,
    ):
        super().__init__()

        self._connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
        )

        if sandbox_id is None:
            self.sandbox_id = self._create_sandbox(
                template=template,
                api_key=api_key,
                timeout=timeout,
                metadata=metadata,
                domain=domain,
                debug=debug,
            )
        else:
            self.sandbox_id = sandbox_id

        sandbox_server_url = (
            f"{'http' if debug else 'https'}://{self.get_hostname(SANDBOX_SERVER_PORT)}"
        )

        self.filesystem = Filesystem(sandbox_server_url)
        self.process = Process(sandbox_server_url)

        self._files = SandboxFiles(sandbox_server_url)

    def get_hostname(self, port: int) -> str:
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
    ) -> None:
        # TODO: Ensure the ** works

        super().set_timeout(
            sandbox_id=self.sandbox_id,
            timeout=timeout,
            **self._connection_config.__dict__,
        )

    def kill(self) -> None:
        super().kill(
            sandbox_id=self.sandbox_id,
            **self._connection_config.__dict__,
        )
