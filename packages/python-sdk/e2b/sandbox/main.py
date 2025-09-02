import urllib.parse

from typing import Optional, TypedDict

from e2b.sandbox.signature import get_signature
from e2b.connection_config import ConnectionConfig
from e2b.envd.api import ENVD_API_FILES_ROUTE
from httpx import Limits


class SandboxOpts(TypedDict):
    sandbox_id: str
    sandbox_domain: Optional[str]
    envd_version: Optional[str]
    envd_access_token: Optional[str]
    connection_config: ConnectionConfig


class SandboxBase:
    _limits = Limits(
        max_keepalive_connections=40,
        max_connections=40,
        keepalive_expiry=300,
    )

    envd_port = 49983

    default_sandbox_timeout = 300
    default_template = "base"

    def __init__(
        self,
        sandbox_id: str,
        envd_version: Optional[str],
        envd_access_token: Optional[str],
        sandbox_domain: Optional[str],
        connection_config: ConnectionConfig,
    ):
        self.__connection_config = connection_config
        self.__sandbox_id = sandbox_id
        self.__sandbox_domain = sandbox_domain or self.connection_config.domain
        self.__envd_version = envd_version
        self.__envd_access_token = envd_access_token
        self.__envd_api_url = f"{'http' if self.connection_config.debug else 'https'}://{self.get_host(self.envd_port)}"

    @property
    def _envd_access_token(self) -> Optional[str]:
        """Private property to access the envd token"""
        return self.__envd_access_token

    @property
    def connection_config(self) -> ConnectionConfig:
        return self.__connection_config

    @property
    def _envd_version(self) -> Optional[str]:
        return self.__envd_version

    @property
    def sandbox_domain(self) -> Optional[str]:
        return self.__sandbox_domain

    @property
    def envd_api_url(self) -> str:
        return self.__envd_api_url

    @property
    def sandbox_id(self) -> str:
        """
        Unique identifier of the sandbox.
        """
        return self.__sandbox_id

    def _file_url(
        self,
        path: str,
        user: str = "user",
        signature: Optional[str] = None,
        signature_expiration: Optional[int] = None,
    ) -> str:
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

    def download_url(
        self,
        path: str,
        user: str = "user",
        use_signature_expiration: Optional[int] = None,
    ) -> str:
        """
        Get the URL to download a file from the sandbox.

        :param path: Path to the file to download
        :param user: User to upload the file as
        :param use_signature_expiration: Expiration time for the signed URL in seconds

        :return: URL for downloading file
        """

        use_signature = self._envd_access_token is not None
        if use_signature:
            signature = get_signature(
                path, "read", user, self._envd_access_token, use_signature_expiration
            )
            return self._file_url(
                path, user, signature["signature"], signature["expiration"]
            )
        else:
            return self._file_url(path)

    def upload_url(
        self,
        path: str,
        user: str = "user",
        use_signature_expiration: Optional[int] = None,
    ) -> str:
        """
        Get the URL to upload a file to the sandbox.

        You have to send a POST request to this URL with the file as multipart/form-data.

        :param path: Path to the file to upload
        :param user: User to upload the file as
        :param use_signature_expiration: Expiration time for the signed URL in seconds

        :return: URL for uploading file
        """

        use_signature = self._envd_access_token is not None
        if use_signature:
            signature = get_signature(
                path, "write", user, self._envd_access_token, use_signature_expiration
            )
            return self._file_url(
                path, user, signature["signature"], signature["expiration"]
            )
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

        return f"{port}-{self.sandbox_id}.{self.sandbox_domain}"
