"""Tests for HTTP transport-level retry logic.

Verifies that TransportWithLogger and AsyncTransportWithLogger correctly
retry on transient errors (5xx status codes, network/protocol errors)
and do NOT retry on timeouts or non-retryable responses.
"""

import asyncio
from unittest.mock import MagicMock, AsyncMock, patch

import httpx
import pytest

from e2b.api import RETRYABLE_STATUS_CODES
from e2b.api.client_sync import TransportWithLogger
from e2b.api.client_async import AsyncTransportWithLogger


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_request() -> httpx.Request:
    return httpx.Request("GET", "https://api.e2b.dev/test")


def _make_response(status_code: int = 200) -> httpx.Response:
    return httpx.Response(status_code, request=_make_request())


# ---------------------------------------------------------------------------
# Sync Transport Tests
# ---------------------------------------------------------------------------


class TestSyncTransportRetry:
    """Tests for TransportWithLogger.handle_request retry logic."""

    @patch("e2b.api.client_sync.time.sleep")
    def test_successful_request_no_retry(self, mock_sleep):
        transport = TransportWithLogger()
        response = _make_response(200)

        with patch.object(
            httpx.HTTPTransport, "handle_request", return_value=response
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 200
        mock_handle.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("e2b.api.client_sync.time.sleep")
    def test_retries_on_502(self, mock_sleep):
        transport = TransportWithLogger()
        bad_response = _make_response(502)
        good_response = _make_response(200)

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=[bad_response, good_response],
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 200
        assert mock_handle.call_count == 2
        mock_sleep.assert_called_once()

    @patch("e2b.api.client_sync.time.sleep")
    def test_retries_on_503(self, mock_sleep):
        transport = TransportWithLogger()
        bad_response = _make_response(503)
        good_response = _make_response(200)

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=[bad_response, good_response],
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 200
        assert mock_handle.call_count == 2

    @patch("e2b.api.client_sync.time.sleep")
    def test_retries_on_504(self, mock_sleep):
        transport = TransportWithLogger()
        bad_response = _make_response(504)
        good_response = _make_response(200)

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=[bad_response, good_response],
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 200
        assert mock_handle.call_count == 2

    @patch("e2b.api.client_sync.time.sleep")
    def test_does_not_retry_on_400(self, mock_sleep):
        transport = TransportWithLogger()
        response = _make_response(400)

        with patch.object(
            httpx.HTTPTransport, "handle_request", return_value=response
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 400
        mock_handle.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("e2b.api.client_sync.time.sleep")
    def test_does_not_retry_on_401(self, mock_sleep):
        transport = TransportWithLogger()
        response = _make_response(401)

        with patch.object(
            httpx.HTTPTransport, "handle_request", return_value=response
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 401
        mock_handle.assert_called_once()

    @patch("e2b.api.client_sync.time.sleep")
    def test_does_not_retry_on_429(self, mock_sleep):
        transport = TransportWithLogger()
        response = _make_response(429)

        with patch.object(
            httpx.HTTPTransport, "handle_request", return_value=response
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 429
        mock_handle.assert_called_once()

    @patch("e2b.api.client_sync.time.sleep")
    def test_retries_on_network_error(self, mock_sleep):
        transport = TransportWithLogger()
        good_response = _make_response(200)

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=[ConnectionError("connection reset"), good_response],
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        assert result.status_code == 200
        assert mock_handle.call_count == 2
        mock_sleep.assert_called_once()

    @patch("e2b.api.client_sync.time.sleep")
    def test_does_not_retry_on_timeout(self, mock_sleep):
        transport = TransportWithLogger()

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=httpx.ReadTimeout("read timed out"),
        ):
            with pytest.raises(httpx.ReadTimeout):
                transport.handle_request(_make_request())

        mock_sleep.assert_not_called()

    @patch("e2b.api.client_sync.request_retries", 3)
    @patch("e2b.api.client_sync.time.sleep")
    def test_exhausts_retries_on_persistent_error(self, mock_sleep):
        transport = TransportWithLogger()

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=ConnectionError("connection reset"),
        ) as mock_handle:
            with pytest.raises(ConnectionError, match="connection reset"):
                transport.handle_request(_make_request())

        # 1 initial + 3 retries = 4 total attempts
        assert mock_handle.call_count == 4
        assert mock_sleep.call_count == 3

    @patch("e2b.api.client_sync.request_retries", 3)
    @patch("e2b.api.client_sync.time.sleep")
    def test_returns_last_retryable_response_when_exhausted(self, mock_sleep):
        transport = TransportWithLogger()
        bad_response = _make_response(503)

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            return_value=bad_response,
        ) as mock_handle:
            result = transport.handle_request(_make_request())

        # After exhausting retries, returns the last 503 response
        assert result.status_code == 503
        assert mock_handle.call_count == 4

    @patch("e2b.api.client_sync.request_retries", 3)
    @patch("e2b.api.client_sync.time.sleep")
    def test_exponential_backoff_timing(self, mock_sleep):
        transport = TransportWithLogger()

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=ConnectionError("fail"),
        ):
            with pytest.raises(ConnectionError):
                transport.handle_request(_make_request())

        # Backoff: min(2^0, 8)=1, min(2^1, 8)=2, min(2^2, 8)=4
        assert mock_sleep.call_args_list[0][0][0] == 1
        assert mock_sleep.call_args_list[1][0][0] == 2
        assert mock_sleep.call_args_list[2][0][0] == 4

    @patch("e2b.api.client_sync.request_retries", 0)
    @patch("e2b.api.client_sync.time.sleep")
    def test_no_retry_when_retries_disabled(self, mock_sleep):
        transport = TransportWithLogger()

        with patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=ConnectionError("fail"),
        ) as mock_handle:
            with pytest.raises(ConnectionError):
                transport.handle_request(_make_request())

        mock_handle.assert_called_once()
        mock_sleep.assert_not_called()


# ---------------------------------------------------------------------------
# Async Transport Tests
# ---------------------------------------------------------------------------


class TestAsyncTransportRetry:
    """Tests for AsyncTransportWithLogger.handle_async_request retry logic."""

    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_successful_request_no_retry(self, mock_sleep):
        transport = AsyncTransportWithLogger()
        response = _make_response(200)

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            return_value=response,
        ) as mock_handle:
            result = await transport.handle_async_request(_make_request())

        assert result.status_code == 200
        mock_handle.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_retries_on_502(self, mock_sleep):
        transport = AsyncTransportWithLogger()
        bad_response = _make_response(502)
        good_response = _make_response(200)

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            side_effect=[bad_response, good_response],
        ) as mock_handle:
            result = await transport.handle_async_request(_make_request())

        assert result.status_code == 200
        assert mock_handle.call_count == 2
        mock_sleep.assert_called_once()

    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_retries_on_network_error(self, mock_sleep):
        transport = AsyncTransportWithLogger()
        good_response = _make_response(200)

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            side_effect=[ConnectionError("h2 connection terminated"), good_response],
        ) as mock_handle:
            result = await transport.handle_async_request(_make_request())

        assert result.status_code == 200
        assert mock_handle.call_count == 2

    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_does_not_retry_on_timeout(self, mock_sleep):
        transport = AsyncTransportWithLogger()

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            side_effect=httpx.ReadTimeout("read timed out"),
        ):
            with pytest.raises(httpx.ReadTimeout):
                await transport.handle_async_request(_make_request())

        mock_sleep.assert_not_called()

    @patch("e2b.api.client_async.request_retries", 3)
    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_exhausts_retries_on_persistent_error(self, mock_sleep):
        transport = AsyncTransportWithLogger()

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            side_effect=ConnectionError("connection terminated"),
        ) as mock_handle:
            with pytest.raises(ConnectionError, match="connection terminated"):
                await transport.handle_async_request(_make_request())

        assert mock_handle.call_count == 4
        assert mock_sleep.call_count == 3

    @patch("e2b.api.client_async.request_retries", 3)
    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_returns_last_retryable_response_when_exhausted(self, mock_sleep):
        transport = AsyncTransportWithLogger()
        bad_response = _make_response(503)

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            return_value=bad_response,
        ) as mock_handle:
            result = await transport.handle_async_request(_make_request())

        assert result.status_code == 503
        assert mock_handle.call_count == 4

    @patch("e2b.api.client_async.request_retries", 0)
    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_no_retry_when_retries_disabled(self, mock_sleep):
        transport = AsyncTransportWithLogger()

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            side_effect=ConnectionError("fail"),
        ) as mock_handle:
            with pytest.raises(ConnectionError):
                await transport.handle_async_request(_make_request())

        mock_handle.assert_called_once()
        mock_sleep.assert_not_called()

    @patch("e2b.api.client_async.request_retries", 3)
    @patch("e2b.api.client_async.asyncio.sleep", new_callable=AsyncMock)
    async def test_exponential_backoff_timing(self, mock_sleep):
        transport = AsyncTransportWithLogger()

        with patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            side_effect=ConnectionError("fail"),
        ):
            with pytest.raises(ConnectionError):
                await transport.handle_async_request(_make_request())

        assert mock_sleep.call_args_list[0][0][0] == 1
        assert mock_sleep.call_args_list[1][0][0] == 2
        assert mock_sleep.call_args_list[2][0][0] == 4
