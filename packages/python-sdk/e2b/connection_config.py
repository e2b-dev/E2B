import os

from typing import Literal, Optional, Dict, TypedDict
from httpx._types import ProxyTypes
from typing_extensions import Unpack

from e2b.api.metadata import package_version

REQUEST_TIMEOUT: float = 60.0  # 60 seconds

KEEPALIVE_PING_INTERVAL_SEC = 50  # 50 seconds
KEEPALIVE_PING_HEADER = "Keepalive-Ping-Interval"


class ApiParams(TypedDict, total=False):
    """
    Parameters for a request.

    In the case of a sandbox, it applies to all **requests made to the returned sandbox**.
    """

    request_timeout: Optional[float]
    """Timeout for the request in **seconds**, defaults to 60 seconds."""

    headers: Optional[Dict[str, str]]
    """Additional headers to send with the request."""

    api_key: Optional[str]
    """E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable."""

    domain: Optional[str]
    """E2B domain to use for authentication, defaults to `E2B_DOMAIN` environment variable."""

    debug: Optional[bool]
    """Whether to use debug mode, defaults to `E2B_DEBUG` environment variable."""

    proxy: Optional[ProxyTypes]
    """Proxy to use for the request. In case of a sandbox it applies to all **requests made to the returned sandbox**."""


class ConnectionConfig:
    """
    Configuration for the connection to the API.
    """

    @staticmethod
    def _domain():
        return os.getenv("E2B_DOMAIN") or "e2b.app"

    @staticmethod
    def _debug():
        return os.getenv("E2B_DEBUG", "false").lower() == "true"

    @staticmethod
    def _api_key():
        return os.getenv("E2B_API_KEY")

    @staticmethod
    def _access_token():
        return os.getenv("E2B_ACCESS_TOKEN")

    def __init__(
        self,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        extra_sandbox_headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
    ):
        self.domain = domain or ConnectionConfig._domain()
        self.debug = debug or ConnectionConfig._debug()
        self.api_key = api_key or ConnectionConfig._api_key()
        self.access_token = access_token or ConnectionConfig._access_token()
        self.headers = headers or {}
        self.headers["User-Agent"] = f"e2b-python-sdk/{package_version}"
        self.__extra_sandbox_headers = extra_sandbox_headers or {}

        self.proxy = proxy

        self.request_timeout = ConnectionConfig._get_request_timeout(
            REQUEST_TIMEOUT,
            request_timeout,
        )

        if request_timeout == 0:
            self.request_timeout = None
        elif request_timeout is not None:
            self.request_timeout = request_timeout
        else:
            self.request_timeout = REQUEST_TIMEOUT

        self.api_url = (
            "http://localhost:3000" if self.debug else f"https://api.{self.domain}"
        )

    @staticmethod
    def _get_request_timeout(
        default_timeout: Optional[float],
        request_timeout: Optional[float],
    ):
        if request_timeout == 0:
            return None
        elif request_timeout is not None:
            return request_timeout
        else:
            return default_timeout

    def get_request_timeout(self, request_timeout: Optional[float] = None):
        return self._get_request_timeout(self.request_timeout, request_timeout)

    def get_api_params(
        self,
        **opts: Unpack[ApiParams],
    ) -> dict:
        """
        Get the parameters for the API call.

        This is used to avoid passing the following attributes to the API call:
        - access_token
        - api_url

        It also returns a copy, so the original object is not modified.

        :return: Dictionary of parameters for the API call
        """
        headers = opts.get("headers")
        request_timeout = opts.get("request_timeout")
        api_key = opts.get("api_key")
        domain = opts.get("domain")
        debug = opts.get("debug")
        proxy = opts.get("proxy")

        req_headers = self.headers.copy()
        if headers is not None:
            req_headers.update(headers)

        return dict(
            ApiParams(
                api_key=api_key if api_key is not None else self.api_key,
                domain=domain if domain is not None else self.domain,
                debug=debug if debug is not None else self.debug,
                request_timeout=self.get_request_timeout(request_timeout),
                headers=req_headers,
                proxy=proxy if proxy is not None else self.proxy,
            )
        )

    @property
    def sandbox_headers(self):
        """
        # We need this separate as we use the same header for E2B access token to API and envd access token to sandbox.
        """
        return {
            **self.headers,
            **self.__extra_sandbox_headers,
        }


Username = Literal["root", "user"]
"""
User used for the operation in the sandbox.
"""

default_username: Username = "user"
"""
Default user used for the operation in the sandbox.
"""
