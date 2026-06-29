import asyncio
import json
import logging
import os
import re
import threading
import weakref
from dataclasses import dataclass
from types import TracebackType
from typing import Callable, Optional, Protocol, Union

import httpx
from httpx import AsyncBaseTransport, BaseTransport, Limits, Timeout

from e2b.api.client.client import AuthenticatedClient
from e2b.api.client.types import Response
from e2b.api.metadata import default_headers
from e2b.connection_config import ConnectionConfig
from e2b.exceptions import (
    AuthenticationException,
    RateLimitException,
    SandboxException,
)


def make_logging_event_hooks(log: Optional[logging.Logger]) -> dict:
    """Build synchronous httpx ``event_hooks`` that log requests and responses
    to the given ``logging.Logger``. Requests log at ``INFO``, successful
    responses at ``INFO`` and responses with status >= 400 at ``ERROR``.

    Returns no hooks when ``log`` is ``None`` so that nothing is logged unless a
    logger was explicitly supplied."""
    if log is None:
        return {}

    def on_request(request) -> None:
        log.info(f"Request {request.method} {request.url}")

    def on_response(response: Response) -> None:
        if response.status_code >= 400:
            log.error(f"Response {response.status_code}")
        else:
            log.info(f"Response {response.status_code}")

    return {"request": [on_request], "response": [on_response]}


def make_async_logging_event_hooks(log: Optional[logging.Logger]) -> dict:
    """Asynchronous counterpart of :func:`make_logging_event_hooks`."""
    if log is None:
        return {}

    async def on_request(request) -> None:
        log.info(f"Request {request.method} {request.url}")

    async def on_response(response: Response) -> None:
        if response.status_code >= 400:
            log.error(f"Response {response.status_code}")
        else:
            log.info(f"Response {response.status_code}")

    return {"request": [on_request], "response": [on_response]}


limits = Limits(
    max_keepalive_connections=int(os.getenv("E2B_MAX_KEEPALIVE_CONNECTIONS", "20")),
    max_connections=int(os.getenv("E2B_MAX_CONNECTIONS", "2000")),
    keepalive_expiry=int(os.getenv("E2B_KEEPALIVE_EXPIRY", "300")),
)

connection_retries = int(os.getenv("E2B_CONNECTION_RETRIES", "3"))

# Number of times to retry a request when a transient error occurs
# (5xx responses, network/protocol errors like h2 ConnectionTerminated, etc.)
request_retries = int(os.getenv("E2B_REQUEST_RETRIES", "3"))

# Status codes that are safe to retry (server-side transient errors)
RETRYABLE_STATUS_CODES = frozenset({502, 503, 504})


@dataclass
class SandboxCreateResponse:
    sandbox_id: str
    sandbox_domain: Optional[str]
    envd_version: str
    envd_access_token: Optional[str]
    traffic_access_token: Optional[str]


def handle_api_exception(
    e: "SupportsApiErrorResponse",
    default_exception_class: type[Exception] = SandboxException,
    stack_trace: Optional[TracebackType] = None,
):
    try:
        body = json.loads(e.content) if e.content else {}
    except json.JSONDecodeError:
        body = {}

    if e.status_code == 401:
        message = f"{e.status_code}: Unauthorized, please check your credentials."
        if body.get("message"):
            message += f" - {body['message']}"
        return AuthenticationException(message)

    if e.status_code == 429:
        message = f"{e.status_code}: Rate limit exceeded, please try again later."
        if body.get("message"):
            message += f" - {body['message']}"
        return RateLimitException(message)

    if "message" in body:
        return default_exception_class(
            f"{e.status_code}: {body['message']}"
        ).with_traceback(stack_trace)
    return default_exception_class(f"{e.status_code}: {e.content}").with_traceback(
        stack_trace
    )


class SupportsApiErrorResponse(Protocol):
    @property
    def status_code(self) -> int: ...

    @property
    def content(self) -> Union[str, bytes]: ...


_API_KEY_PATTERN = re.compile(r"\Ae2b_[0-9a-f]+\Z")
_API_KEY_EXAMPLE = "e2b_" + "0" * 40


def validate_api_key(api_key: str) -> None:
    """Validate that an E2B API key has the expected ``e2b_`` prefix
    followed by hex characters. Raises ``AuthenticationException`` otherwise.
    """
    if not _API_KEY_PATTERN.match(api_key):
        raise AuthenticationException(
            'Invalid API key format: expected "e2b_" followed by hex '
            f'characters (e.g. "{_API_KEY_EXAMPLE}"). '
            "Visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key."
        )


class ApiClient(AuthenticatedClient):
    """
    The client for interacting with the E2B API.
    """

    def __init__(
        self,
        config: ConnectionConfig,
        transport: Optional[Union[BaseTransport, AsyncBaseTransport]] = None,
        transport_factory: Optional[Callable[[], BaseTransport]] = None,
        async_transport_factory: Optional[Callable[[], AsyncBaseTransport]] = None,
        *args,
        **kwargs,
    ):
        if transport is not None and (
            transport_factory is not None or async_transport_factory is not None
        ):
            raise ValueError("Use either transport or transport_factory, not both")

        self._transport_factory = transport_factory
        self._async_transport_factory = async_transport_factory
        self._thread_local = threading.local()
        # Keyed weakly by the event loop object itself, not id(loop) —
        # CPython reuses object ids, so a new loop could otherwise inherit
        # a client bound to a previous, closed loop.
        self._async_clients: weakref.WeakKeyDictionary[
            asyncio.AbstractEventLoop, httpx.AsyncClient
        ] = weakref.WeakKeyDictionary()
        self._proxy = config.proxy

        if config.api_key is None:
            raise AuthenticationException(
                "API key is required, please visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key. "
                "You can either set the environment variable `E2B_API_KEY` "
                'or you can pass it directly to the method like api_key="e2b_..."',
            )

        if config.api_key is not None and config.validate_api_key:
            validate_api_key(config.api_key)

        token = config.api_key
        auth_header_name = "X-API-KEY"
        prefix = ""

        self._logger = config.logger

        headers = {
            **default_headers,
            # Deprecated: send the access token alongside the API key when one
            # is available, mirroring the JS SDK. Prefer `api_headers` instead.
            # Spread before `config.headers` so a custom `Authorization` in
            # `api_headers` wins over the deprecated access token, matching JS.
            **(
                {"Authorization": f"Bearer {config.access_token}"}
                if config.access_token is not None
                else {}
            ),
            **(config.headers or {}),
        }

        # Prevent passing these parameters twice
        more_headers: Optional[dict] = kwargs.pop("headers", None)
        if more_headers:
            headers.update(more_headers)
        kwargs.pop("token", None)
        kwargs.pop("auth_header_name", None)
        kwargs.pop("prefix", None)

        httpx_args = {
            "event_hooks": self._logging_event_hooks(),
        }
        if transport is not None:
            httpx_args["transport"] = transport
        if (
            transport is None
            and transport_factory is None
            and async_transport_factory is None
        ):
            httpx_args["proxy"] = config.proxy

        # config.request_timeout is None when the timeout is explicitly
        # disabled (request_timeout=0), which httpx.Timeout(None) preserves.
        kwargs.setdefault("timeout", Timeout(config.request_timeout))

        super().__init__(
            base_url=config.api_url,
            httpx_args=httpx_args,
            headers=headers,
            token=token or "",
            auth_header_name=auth_header_name,
            prefix=prefix,
            *args,
            **kwargs,
        )

    def _logging_event_hooks(self) -> dict:
        return make_logging_event_hooks(self._logger)

    def _headers_with_auth(self) -> dict:
        return {
            **self._headers,
            self.auth_header_name: (
                f"{self.prefix} {self.token}" if self.prefix else self.token
            ),
        }

    def get_httpx_client(self) -> httpx.Client:
        if self._client is not None or self._transport_factory is None:
            return super().get_httpx_client()

        client = getattr(self._thread_local, "client", None)
        if client is None:
            client = httpx.Client(
                base_url=self._base_url,
                cookies=self._cookies,
                headers=self._headers_with_auth(),
                timeout=self._timeout,
                verify=self._verify_ssl,
                follow_redirects=self._follow_redirects,
                event_hooks=self._httpx_args.get("event_hooks"),
                transport=self._transport_factory(),
            )
            self._thread_local.client = client
        return client

    def get_async_httpx_client(self) -> httpx.AsyncClient:
        if self._async_client is not None or self._async_transport_factory is None:
            return super().get_async_httpx_client()

        loop = asyncio.get_running_loop()
        client = self._async_clients.get(loop)
        if client is None:
            client = httpx.AsyncClient(
                base_url=self._base_url,
                cookies=self._cookies,
                headers=self._headers_with_auth(),
                timeout=self._timeout,
                verify=self._verify_ssl,
                follow_redirects=self._follow_redirects,
                event_hooks=self._httpx_args.get("event_hooks"),
                transport=self._async_transport_factory(),
            )
            self._async_clients[loop] = client
        return client


# We need to override the logging hooks for the async usage
class AsyncApiClient(ApiClient):
    def _logging_event_hooks(self) -> dict:
        return make_async_logging_event_hooks(self._logger)
