import urllib.parse
import httpcore

from typing import Optional, Dict

from e2b.sandbox.filesystem.filesystem import Filesystem
from e2b.sandbox.process.main import Process
from e2b.sandbox.sandbox_api import SandboxApi
from e2b.connection_config import ConnectionConfig
from e2b.envd.api import ENVD_API_FILES_ROUTE
from e2b.exceptions import SandboxException

# TODO: Add logs


class Sandbox(SandboxApi):
    _envd_port = 49982

    @property
    def files(self) -> Filesystem:
        return self._filesystem

    @property
    def commands(self) -> Process:
        return self._process

    def __init__(
        self,
        template: str = "base-v1",
        timeout: int = 300,
        metadata: Optional[Dict[str, str]] = None,
        api_key: Optional[str] = None,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        sandbox_id: Optional[str] = None,
        request_timeout: Optional[float] = None,
    ):
        super().__init__()

        if sandbox_id and (
            metadata is not None or timeout is not None or template is not None
        ):
            raise SandboxException(
                "Cannot set metadata or timeout when connecting to an existing sandbox. "
                "Use Sandbox.connect method instead.",
            )

        self._connection_config = ConnectionConfig(
            api_key=api_key,
            domain=domain,
            debug=debug,
            request_timeout=request_timeout,
        )

        if self._connection_config.debug:
            self.sandbox_id = "debug_sandbox_id"
        elif sandbox_id is not None:
            self.sandbox_id = sandbox_id
        else:
            self.sandbox_id = SandboxApi._create_sandbox(
                template=template,
                api_key=api_key,
                timeout=timeout,
                metadata=metadata,
                domain=domain,
                debug=debug,
                request_timeout=request_timeout,
            )

        self._envd_api_url = (
            f"{'http' if debug else 'https'}://{self.get_host(self._envd_port)}"
        )

        pool = httpcore.ConnectionPool(max_connections=25)

        self._filesystem = Filesystem(self._envd_api_url, self._connection_config, pool)
        self._process = Process(self._envd_api_url, self._connection_config, pool)

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

    @property
    def upload_url(self) -> str:
        url = urllib.parse.urljoin(self._envd_api_url, f"/{ENVD_API_FILES_ROUTE}?")
        params = urllib.parse.urlencode(
            {"username": urllib.parse.quote("user")},
        )
        url = urllib.parse.urljoin(url, params)

        return url

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.kill()
