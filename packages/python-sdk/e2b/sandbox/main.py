import urllib.parse

from abc import ABC, abstractmethod
from typing import Optional

from e2b.connection_config import ConnectionConfig
from e2b.envd.api import ENVD_API_FILES_ROUTE
from httpx import Limits


class SandboxSetup(ABC):
    _limits = Limits(
        max_keepalive_connections=40,
        max_connections=40,
        keepalive_expiry=300,
    )

    envd_port = 49983

    default_sandbox_timeout = 300
    default_template = "base"

    @property
    @abstractmethod
    def connection_config(self) -> ConnectionConfig: ...

    @property
    @abstractmethod
    def envd_api_url(self) -> str: ...

    @property
    @abstractmethod
    def sandbox_id(self) -> str: ...

    def _file_url(self, path: Optional[str] = None) -> str:
        url = urllib.parse.urljoin(self.envd_api_url, ENVD_API_FILES_ROUTE)
        query = {"path": path} if path else {}
        query = {**query, "username": "user"}

        params = urllib.parse.urlencode(
            query,
            quote_via=urllib.parse.quote,
        )
        url = urllib.parse.urljoin(url, f"?{params}")

        return url

    def download_url(self, path: str) -> str:
        """
        Get the URL to download a file from the sandbox.

        :param path: Path to the file to download

        :return: URL for downloading file
        """
        return self._file_url(path)

    def upload_url(self, path: Optional[str] = None) -> str:
        """
        Get the URL to upload a file to the sandbox.

        You have to send a POST request to this URL with the file as multipart/form-data.

        :param path: Path to the file to upload

        :return: URL for uploading file
        """
        return self._file_url(path)

    def get_host(self, port: int) -> str:
        """
        Get the host address to connect to the sandbox.
        You can then use this address to connect to the sandbox port from outside the sandbox via HTTP or WebSocket.

        :param port: Port to connect to

        :return: Host address to connect to
        """
        if self.connection_config.debug:
            return f"localhost:{port}"

        return f"{port}-{self.sandbox_id}.{self.connection_config.domain}"
