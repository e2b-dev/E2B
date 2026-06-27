import logging
import os

from typing import cast, Optional, Dict, TypedDict

from httpx._types import ProxyTypes
from typing_extensions import Unpack

from e2b.api.metadata import package_version
from e2b.sandbox_domains import is_supported_sandbox_domain

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
    """Additional headers to send with the request. Deprecated, use api_headers instead."""

    api_headers: Optional[Dict[str, str]]
    """Additional headers to send with E2B API requests."""

    api_key: Optional[str]
    """E2B API Key to use for authentication, defaults to `E2B_API_KEY` environment variable."""

    validate_api_key: Optional[bool]
    """Whether to validate the format of the E2B API key on the client side.
    Disable this when your deployment issues API keys that don't match the
    default `e2b_` format. Defaults to `E2B_VALIDATE_API_KEY` environment
    variable or `True`."""

    domain: Optional[str]
    """E2B domain to use for authentication, defaults to `E2B_DOMAIN` environment variable."""

    api_url: Optional[str]
    """URL to use for the API, defaults to `https://api.<domain>`. For internal use only."""

    debug: Optional[bool]
    """Whether to use debug mode, defaults to `E2B_DEBUG` environment variable."""

    proxy: Optional[ProxyTypes]
    """Proxy to use for the request. In case of a sandbox it applies to all **requests made to the returned sandbox**."""

    sandbox_url: Optional[str]
    """URL to connect to sandbox, defaults to `E2B_SANDBOX_URL` environment variable."""


class ApiParamsWithLogger(ApiParams, total=False):
    """:class:`ApiParams` plus the construction-time ``logger``.

    Internal type returned by :meth:`ConnectionConfig.get_api_params` so that the
    logger a sandbox was created/connected with keeps propagating to the
    throwaway ``ConnectionConfig`` that instance control-plane methods rebuild.
    Unlike :class:`ApiParams`, ``logger`` is not a public per-request option.
    """

    logger: Optional[logging.Logger]


class ConnectionConfig:
    """
    Configuration for the connection to the API.
    """

    envd_port = 49983

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
    def _validate_api_key():
        return os.getenv("E2B_VALIDATE_API_KEY", "true").lower() != "false"

    @staticmethod
    def _api_url():
        return os.getenv("E2B_API_URL")

    @staticmethod
    def _sandbox_url():
        return os.getenv("E2B_SANDBOX_URL")

    @staticmethod
    def _access_token():
        return os.getenv("E2B_ACCESS_TOKEN")

    @staticmethod
    def _build_user_agent(
        integration: Optional[str] = None,
    ) -> str:
        user_agent_parts = [f"e2b-python-sdk/{package_version}"]

        if integration:
            user_agent_parts.append(integration)

        return " ".join(user_agent_parts)

    def __init__(
        self,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        api_key: Optional[str] = None,
        validate_api_key: Optional[bool] = None,
        api_url: Optional[str] = None,
        sandbox_url: Optional[str] = None,
        access_token: Optional[str] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        api_headers: Optional[Dict[str, str]] = None,
        integration: Optional[str] = None,
        extra_sandbox_headers: Optional[Dict[str, str]] = None,
        proxy: Optional[ProxyTypes] = None,
        logger: Optional[logging.Logger] = None,
    ):
        self.logger = logger
        self.domain = domain or ConnectionConfig._domain()
        self.debug = debug if debug is not None else ConnectionConfig._debug()
        self.api_key = api_key or ConnectionConfig._api_key()
        self.validate_api_key = (
            validate_api_key
            if validate_api_key is not None
            else ConnectionConfig._validate_api_key()
        )
        # Deprecated: pass the token through `api_headers` instead, e.g.
        # api_headers={"Authorization": f"Bearer {token}"}.
        self.access_token = access_token or ConnectionConfig._access_token()
        self.integration = integration
        self.headers = {**(headers or {}), **(api_headers or {})}
        if self.integration is not None or "User-Agent" not in self.headers:
            self.headers["User-Agent"] = self._build_user_agent(
                self.integration,
            )
        self.__extra_sandbox_headers = extra_sandbox_headers or {}

        self.proxy = proxy

        self.request_timeout = ConnectionConfig._get_request_timeout(
            REQUEST_TIMEOUT,
            request_timeout,
        )

        self.api_url = (
            api_url
            or ConnectionConfig._api_url()
            or ("http://localhost:3000" if self.debug else f"https://api.{self.domain}")
        )

        self._sandbox_url: Optional[str] = (
            sandbox_url or ConnectionConfig._sandbox_url()
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

    def get_sandbox_url(self, sandbox_id: str, sandbox_domain: str) -> str:
        if self._sandbox_url:
            return self._sandbox_url  # type: ignore[return-value]

        if self.debug:
            return f"http://{self.get_host(sandbox_id, sandbox_domain, self.envd_port)}"

        sandbox_domain = sandbox_domain or self.domain
        if is_supported_sandbox_domain(sandbox_domain):
            return f"https://sandbox.{sandbox_domain}"

        return f"https://{self.get_host(sandbox_id, sandbox_domain, self.envd_port)}"

    def get_sandbox_direct_url(self, sandbox_id: str, sandbox_domain: str) -> str:
        if self._sandbox_url:
            return self._sandbox_url  # type: ignore[return-value]

        if self.debug:
            return f"http://{self.get_host(sandbox_id, sandbox_domain, self.envd_port)}"

        return f"https://{self.get_host(sandbox_id, sandbox_domain, self.envd_port)}"

    def get_host(self, sandbox_id: str, sandbox_domain: str, port: int) -> str:
        """
        Get the host address to connect to the sandbox.
        You can then use this address to connect to the sandbox port from outside the sandbox via HTTP or WebSocket.

        :param port: Port to connect to
        :param sandbox_domain: Domain to connect to
        :param sandbox_id: Sandbox to connect to

        :return: Host address to connect to
        """
        if self.debug:
            return f"localhost:{port}"

        return f"{port}-{sandbox_id}.{sandbox_domain}"

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
        api_headers = opts.get("api_headers")
        request_timeout = opts.get("request_timeout")
        api_key = opts.get("api_key")
        validate_api_key = opts.get("validate_api_key")
        api_url = opts.get("api_url")
        domain = opts.get("domain")
        debug = opts.get("debug")
        proxy = opts.get("proxy")
        sandbox_url = opts.get("sandbox_url")

        req_headers = self.headers.copy()
        if headers is not None:
            req_headers.update(headers)
        if api_headers is not None:
            req_headers.update(api_headers)
        if self.integration is not None:
            req_headers["User-Agent"] = self._build_user_agent(
                self.integration,
            )

        # `logger` is a construction-time option rather than a per-request
        # ApiParams field, but it must propagate to the throwaway
        # ConnectionConfig that instance control-plane methods (kill, pause,
        # set_timeout, get_info, connect, ...) rebuild from these params, so
        # those requests keep logging with the logger the sandbox was created
        # or connected with.
        return dict(
            ApiParamsWithLogger(
                api_key=api_key if api_key is not None else self.api_key,
                validate_api_key=(
                    validate_api_key
                    if validate_api_key is not None
                    else self.validate_api_key
                ),
                api_url=api_url if api_url is not None else self.api_url,
                domain=domain if domain is not None else self.domain,
                debug=debug if debug is not None else self.debug,
                request_timeout=self.get_request_timeout(request_timeout),
                headers=req_headers,
                proxy=proxy if proxy is not None else self.proxy,
                sandbox_url=(
                    sandbox_url
                    if sandbox_url is not None
                    else cast(Optional[str], self._sandbox_url)
                ),
                logger=self.logger,
            )
        )

    @property
    def sandbox_headers(self):
        """
        We need this separate as we use the same header for E2B access token to API and envd access token to sandbox.
        """
        return {
            "User-Agent": self.headers["User-Agent"],
            **self.__extra_sandbox_headers,
        }


Username = str
"""
User used for the operation in the sandbox.
"""

default_username: Username = "user"
"""
Default user used for the operation in the sandbox.
"""
