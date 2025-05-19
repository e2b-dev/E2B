import urllib.parse

from abc import ABC, abstractmethod
from typing import Optional

from e2b.sandbox.signature import get_signature
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
    def connection_config(self) -> ConnectionConfig:
        ...

    @property
    @abstractmethod
    def _envd_access_token(self) -> Optional[str]:
        ...

    @property
    @abstractmethod
    def envd_api_url(self) -> str:
        ...

    @property
    @abstractmethod
    def sandbox_id(self) -> str:
        ...

    def _file_url(self, path: Optional[str] = None, user: str = "user", signature: Optional[str] = None, signature_expiration: Optional[int] = None) -> str:
        url = urllib.parse.urljoin(self.envd_api_url, ENVD_API_FILES_ROUTE)
        query = {"path": path} if path else {}
        query = {**query, "username": user}

        if signature:
            query["signature"] = signature

        if signature_expiration:
            if signature is None:
                raise ValueError("signature_expiration requires signature to be set")
            query["signature_expiration"] = str(signature_expiration)

        params = urllib.parse.urlencode(
            query,
            quote_via=urllib.parse.quote,
        )
        url = urllib.parse.urljoin(url, f"?{params}")

        return url

    def download_url(self, path: str, user: str = "user", use_signature: bool = False, use_signature_expiration: Optional[int] = None) -> str:
        """
        Get the URL to download a file from the sandbox.

        :param path: Path to the file to download
        :param user: User to upload the file as
        :param use_signature: Whether to use a signed URL for downloading the file
        :param use_signature_expiration: Expiration time for the signed URL in seconds

        :return: URL for downloading file
        """

        if use_signature:
            signature = get_signature(path, "read", user, self._envd_access_token, use_signature_expiration)
            return self._file_url(path, user, signature["signature"], signature["expiration"])
        else:
            return self._file_url(path)

    def upload_url(self, path: Optional[str] = None, user: str = "user", use_signature: bool = False, use_signature_expiration: Optional[int] = None) -> str:
        """
        Get the URL to upload a file to the sandbox.

        You have to send a POST request to this URL with the file as multipart/form-data.

        :param path: Path to the file to upload
        :param user: User to upload the file as
        :param use_signature: Whether to use a signed URL for downloading the file
        :param use_signature_expiration: Expiration time for the signed URL in seconds

        :return: URL for uploading file
        """

        if use_signature:
            signature = get_signature(path, "write", user, self._envd_access_token, use_signature_expiration)
            return self._file_url(path, user, signature["signature"], signature["expiration"])
        else:
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
