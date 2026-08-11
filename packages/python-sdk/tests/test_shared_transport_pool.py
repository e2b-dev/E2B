"""The envd RPC stack and the envd HTTP API share one connection pool, so a
sandbox costs one HTTP/2 connection instead of one per stack (SDK-291).

That sharing puts the sandbox health probe on the connection the failed RPC
was using: ``handle_rpc_exception_with_health`` calls ``/health`` precisely
when an RPC died at the transport layer, and it must still get an answer, or
every dropped connection would be reported as an indeterminate state instead
of "the sandbox is gone". These tests pin that at the frame level rather than
trusting reqwest to discard broken connections — a real plaintext HTTP/2
server serves both routes on one pool and counts the TCP connections the
client opens (see ``envd_frame_server``):

* an ``RST_STREAM`` kills the RPC stream only, so the probe reuses the same
  connection (which is what proves the pool is genuinely shared);
* a dropped TCP connection makes reqwest redial for the probe.

The pool here mirrors the SDK's — the same connect-retry middleware under the
same plain-error normalization — but with HTTP/2 prior knowledge, since the
transports the SDK builds negotiate the version over TLS via ALPN and this
server is plaintext.
"""

import httpx
import pytest
from connectrpc.errors import ConnectError
from envd_frame_server import (
    assert_stdout_event,
    make_async_client,
    make_sync_client,
    shared_pool_server,
)
from pyqwest import HTTPTransport, HTTPVersion, SyncHTTPTransport
from pyqwest.httpx import AsyncPyqwestTransport, PyqwestTransport

from e2b.api import connection_retries
from e2b.api.client_async import ConnectionRetryTransport
from e2b.api.client_sync import (
    ConnectionRetryTransport as SyncConnectionRetryTransport,
)
from e2b.envd.api import acheck_sandbox_health, check_sandbox_health
from e2b.envd.client_async import PlainHTTPErrorTransport
from e2b.envd.client_sync import (
    PlainHTTPErrorTransport as SyncPlainHTTPErrorTransport,
)
from e2b.envd.process.process_pb import ConnectRequest
from e2b.envd.rpc import is_transport_failure


def _sync_pool() -> SyncConnectionRetryTransport:
    return SyncConnectionRetryTransport(
        SyncHTTPTransport(http_version=HTTPVersion.HTTP2),
        max_retries=connection_retries,
    )


def _async_pool() -> ConnectionRetryTransport:
    return ConnectionRetryTransport(
        HTTPTransport(http_version=HTTPVersion.HTTP2),
        max_retries=connection_retries,
    )


def _break_sync_stream(events) -> ConnectError:
    """Read the first event, then the failure the server injects after it."""
    assert_stdout_event(next(events))
    with pytest.raises(ConnectError) as excinfo:
        next(events)
    assert is_transport_failure(excinfo.value), excinfo.value
    return excinfo.value


async def _break_async_stream(events) -> ConnectError:
    assert_stdout_event(await events.__anext__())
    with pytest.raises(ConnectError) as excinfo:
        await events.__anext__()
    assert is_transport_failure(excinfo.value), excinfo.value
    return excinfo.value


def test_sync_stream_reset_leaves_the_shared_connection_usable():
    with shared_pool_server("reset") as server:
        pool = _sync_pool()
        envd_api = httpx.Client(
            base_url=f"http://127.0.0.1:{server.port}",
            transport=PyqwestTransport(pool),
        )
        try:
            _break_sync_stream(
                make_sync_client(
                    server.port, transport=SyncPlainHTTPErrorTransport(pool)
                ).connect(ConnectRequest())
            )
            assert check_sandbox_health(envd_api) is True
            # One TCP connection served the RPC and the probe: the reset took
            # down the stream, not the connection.
            assert len(server.connections) == 1
            server.assert_no_errors()
        finally:
            envd_api.close()


def test_sync_dropped_connection_redials_for_the_health_probe():
    with shared_pool_server("drop") as server:
        pool = _sync_pool()
        envd_api = httpx.Client(
            base_url=f"http://127.0.0.1:{server.port}",
            transport=PyqwestTransport(pool),
        )
        try:
            _break_sync_stream(
                make_sync_client(
                    server.port, transport=SyncPlainHTTPErrorTransport(pool)
                ).connect(ConnectRequest())
            )
            # The probe must not be answered from the dead pooled connection.
            assert check_sandbox_health(envd_api) is True
            assert len(server.connections) == 2
        finally:
            envd_api.close()


async def test_async_stream_reset_leaves_the_shared_connection_usable():
    with shared_pool_server("reset") as server:
        pool = _async_pool()
        envd_api = httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{server.port}",
            transport=AsyncPyqwestTransport(pool),
        )
        try:
            await _break_async_stream(
                make_async_client(
                    server.port, transport=PlainHTTPErrorTransport(pool)
                ).connect(ConnectRequest())
            )
            assert await acheck_sandbox_health(envd_api) is True
            assert len(server.connections) == 1
            server.assert_no_errors()
        finally:
            await envd_api.aclose()


async def test_async_dropped_connection_redials_for_the_health_probe():
    with shared_pool_server("drop") as server:
        pool = _async_pool()
        envd_api = httpx.AsyncClient(
            base_url=f"http://127.0.0.1:{server.port}",
            transport=AsyncPyqwestTransport(pool),
        )
        try:
            await _break_async_stream(
                make_async_client(
                    server.port, transport=PlainHTTPErrorTransport(pool)
                ).connect(ConnectRequest())
            )
            assert await acheck_sandbox_health(envd_api) is True
            assert len(server.connections) == 2
        finally:
            await envd_api.aclose()
