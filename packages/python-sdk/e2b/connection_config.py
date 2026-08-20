import logging
import os

from typing import cast, Mapping, Optional, Dict, TypedDict, Union

import httpx
from typing_extensions import Unpack

from e2b.api.metadata import package_version
from e2b.sandbox_domains import is_supported_sandbox_domain

ProxyTypes = Union[str, httpx.URL, httpx.Proxy]
"""The forms the ``proxy`` option accepts: a URL string, an ``httpx.URL``, or
an ``httpx.Proxy``.

Identical to ``httpx._types.ProxyTypes``, spelled out here so the SDK doesn't
import httpx's private module at runtime — and so the union can grow a pyqwest
proxy type as the transports move off httpx. :func:`e2b.api.proxy_to_config`
narrows it to what the pyqwest REST transports take.
"""

REQUEST_TIMEOUT: float = 60.0  # 60 seconds

# Idle bound for every read on the streaming envd file-transfer transport:
# the transfer is aborted when no bytes at all arrive for this long. It
# resets on each chunk, so it never limits total transfer time — only a
# fully stalled stream. Matches the previous default stream idle timeout
# (the request timeout).
#
# Kept equal to `e2b.volume.connection_config.READ_TIMEOUT` on purpose: the
# read bound is part of the transport cache key, so the volume streaming pool
# and the sandbox-filesystem streaming pool are the same reqwest pool only
# while the two constants agree. Change one and they silently split in two.
READ_TIMEOUT: float = 60.0  # 60 seconds

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


def merge_api_params(
    bound_params: Optional[ApiParams], params: Mapping[str, object]
) -> ApiParams:
    """
    Merge the API params bound to a class (e.g. by an :class:`e2b.E2B` client)
    with the per-call params. Per-call params win, then the bound params, then
    the environment variables resolved by :class:`ConnectionConfig`.

    Per-call params explicitly set to ``None`` are dropped so they fall back to
    the bound params instead of clearing them.

    :meta private:
    """
    if not bound_params:
        return cast(ApiParams, params)

    merged = cast(Dict[str, object], dict(bound_params))
    merged.update({k: v for k, v in params.items() if v is not None})
    return cast(ApiParams, merged)


class ClientFactory:
    """
    Base class for the resource classes (`Sandbox`, `Volume`, `Template`,
    `Secret`) whose classmethods build a :class:`ConnectionConfig` from per-call
    params. An :class:`e2b.E2B` client exposes subclasses of these with its own
    params bound, and every classmethod resolves them through
    :meth:`_resolve_api_params`.

    :meta private:
    """

    _bound_api_params: ApiParams = {}
    """API params bound to this class by an :class:`e2b.E2B` client.

    Empty on the base classes, so the env-configured default path is unchanged.

    :meta private:
    """

    @classmethod
    def _resolve_api_params(cls, **opts: Unpack[ApiParams]) -> ApiParams:
        """
        Merge the API params bound to this class with the per-call params.

        :meta private:
        """
        return merge_api_params(cls._bound_api_params, opts)


class ConnectionConfig:
    """
    Configuration for the connection to the API.
    """

    envd_port = 49983

    _integration: Optional[str] = None

    @classmethod
    def set_integration(cls, integration: Optional[str]) -> None:
        """
        Identify traffic from an integration wrapping the E2B SDK by appending
        ``integration`` (e.g. ``"e2b-code-interpreter/0.1.0"``) to the
        ``User-Agent`` header of every request.

        Call once at startup, before any ``ConnectionConfig`` is constructed —
        configs read the value at construction time. Pass ``None`` to clear.

        Internal use only — not part of the public, stable API.

        :meta private:
        """
        ConnectionConfig._integration = integration

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
    def _build_user_agent() -> str:
        user_agent_parts = [f"e2b-python-sdk/{package_version}"]

        if ConnectionConfig._integration:
            user_agent_parts.append(ConnectionConfig._integration)

        return " ".join(user_agent_parts)

    def _apply_user_agent(
        self,
        headers: Dict[str, str],
        user_agent_override: Optional[str],
    ) -> bool:
        """
        Set the ``User-Agent`` on ``headers``: an explicitly provided value
        always wins; otherwise the SDK-built one, tagged with the current
        integration.

        Returns whether the SDK-built value was applied, so callers can keep
        it in sync with the current integration on later rebuilds.
        """
        if user_agent_override is not None:
            headers["User-Agent"] = user_agent_override
            return False

        headers["User-Agent"] = self._build_user_agent()
        return True

    def __init__(
        self,
        domain: Optional[str] = None,
        debug: Optional[bool] = None,
        api_key: Optional[str] = None,
        validate_api_key: Optional[bool] = None,
        api_url: Optional[str] = None,
        sandbox_url: Optional[str] = None,
        request_timeout: Optional[float] = None,
        headers: Optional[Dict[str, str]] = None,
        api_headers: Optional[Dict[str, str]] = None,
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
        self.headers = {**(headers or {}), **(api_headers or {})}
        self._user_agent_is_sdk_built = self._apply_user_agent(
            self.headers,
            self.headers.get("User-Agent"),
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
        if self._user_agent_is_sdk_built:
            # Same precedence as the merge above: api_headers wins over headers.
            per_call_user_agent = {**(headers or {}), **(api_headers or {})}.get(
                "User-Agent"
            )
            self._apply_user_agent(req_headers, per_call_user_agent)

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
