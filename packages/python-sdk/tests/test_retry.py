import httpx
import pytest

from e2b._retry import (
    _RETRYABLE_STATUS,
    classify_exception,
    compute_delay,
    parse_retry_after,
    resolve_max_retries,
    retry_request_async,
    retry_request_sync,
)


def _response(status, headers=None):
    return httpx.Response(status, headers=headers or {})


class _Sender:
    """Returns/raises queued outcomes in order and records requests."""

    def __init__(self, outcomes):
        self.outcomes = outcomes
        self.calls = []
        self.i = 0

    def __call__(self, request):
        self.calls.append(request)
        outcome = self.outcomes[min(self.i, len(self.outcomes) - 1)]
        self.i += 1
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


# ---------------------------------------------------------------------------
# resolve_max_retries
# ---------------------------------------------------------------------------


def test_resolve_max_retries_explicit():
    assert resolve_max_retries(5) == 5
    assert resolve_max_retries(0) == 0


def test_resolve_max_retries_env_then_default(monkeypatch):
    monkeypatch.delenv("E2B_MAX_RETRIES", raising=False)
    assert resolve_max_retries(None) == 3
    monkeypatch.setenv("E2B_MAX_RETRIES", "7")
    assert resolve_max_retries(None) == 7


def test_resolve_max_retries_negative_raises():
    with pytest.raises(ValueError):
        resolve_max_retries(-1)


# ---------------------------------------------------------------------------
# parse_retry_after / compute_delay
# ---------------------------------------------------------------------------


def test_parse_retry_after_seconds():
    assert parse_retry_after("2") == 2.0
    assert parse_retry_after("0") == 0.0


def test_parse_retry_after_http_date():
    from datetime import datetime, timezone

    now = datetime(2020, 1, 1, tzinfo=timezone.utc)
    future = "Wed, 01 Jan 2020 00:00:05 GMT"
    assert parse_retry_after(future, now) == 5.0


def test_parse_retry_after_invalid():
    assert parse_retry_after(None) is None
    assert parse_retry_after("soon") is None


def test_compute_delay_honors_retry_after():
    assert compute_delay(0, retry_after=2.0) == 2.0


def test_compute_delay_jitter_bounds():
    for attempt in range(6):
        d = compute_delay(attempt, base=0.5, cap=8.0)
        exp = min(8.0, 0.5 * (2**attempt))
        assert 0 <= d <= exp


# ---------------------------------------------------------------------------
# classify_exception
# ---------------------------------------------------------------------------


def test_classify_exception():
    assert classify_exception(httpx.ConnectError("x")) == "rejected"
    assert classify_exception(httpx.ConnectTimeout("x")) == "rejected"
    assert classify_exception(httpx.ReadError("x")) == "ambiguous"
    assert classify_exception(httpx.RemoteProtocolError("x")) == "ambiguous"
    assert classify_exception(ValueError("x")) is None


# ---------------------------------------------------------------------------
# retry_request_sync
# ---------------------------------------------------------------------------


def _no_sleep(_):
    pass


def test_sync_retries_503_then_succeeds():
    sender = _Sender([_response(503), _response(200)])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    res = retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert res.status_code == 200
    assert len(sender.calls) == 2


def test_sync_honors_retry_after():
    sleeps = []
    sender = _Sender([_response(429, {"retry-after": "2"}), _response(200)])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    res = retry_request_sync(req, sender, retries=3, sleep=sleeps.append)
    assert res.status_code == 200
    assert sleeps == [2.0]


def test_sync_does_not_retry_non_retryable_status():
    sender = _Sender([_response(400)])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    res = retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert res.status_code == 400
    assert len(sender.calls) == 1


def test_sync_exhausts_and_returns_last():
    sender = _Sender([_response(502)])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    res = retry_request_sync(req, sender, retries=2, sleep=_no_sleep)
    assert res.status_code == 502
    assert len(sender.calls) == 3


def test_sync_post_does_not_retry_ambiguous():
    sender = _Sender([_response(502)])
    req = httpx.Request("POST", "http://api.test/rpc", content=b"x")
    res = retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert res.status_code == 502
    assert len(sender.calls) == 1


def test_sync_post_retries_rejected():
    sender = _Sender([_response(429), _response(200)])
    req = httpx.Request("POST", "http://api.test/rpc", content=b"x")
    res = retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert res.status_code == 200
    assert len(sender.calls) == 2


def test_sync_post_does_not_retry_503_ambiguous():
    sender = _Sender([_response(503)])
    req = httpx.Request("POST", "http://api.test/rpc", content=b"x")
    res = retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert res.status_code == 503
    assert len(sender.calls) == 1


def test_sync_retries_on_connection_error():
    sender = _Sender([httpx.ConnectError("boom"), _response(200)])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    res = retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert res.status_code == 200
    assert len(sender.calls) == 2


def test_sync_does_not_retry_unknown_error():
    sender = _Sender([ValueError("nope")])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    with pytest.raises(ValueError):
        retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert len(sender.calls) == 1


def test_sync_streaming_body_not_retried():
    def gen():
        yield b"chunk"

    sender = _Sender([_response(503)])
    req = httpx.Request("POST", "http://api.test/rpc", content=gen())
    res = retry_request_sync(req, sender, retries=3, sleep=_no_sleep)
    assert res.status_code == 503
    assert len(sender.calls) == 1


def test_sync_retries_zero_single_attempt():
    sender = _Sender([_response(503)])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    res = retry_request_sync(req, sender, retries=0, sleep=_no_sleep)
    assert res.status_code == 503
    assert len(sender.calls) == 1


# ---------------------------------------------------------------------------
# retry_request_async
# ---------------------------------------------------------------------------


class _AsyncSender:
    def __init__(self, outcomes):
        self.outcomes = outcomes
        self.calls = []
        self.i = 0

    async def __call__(self, request):
        self.calls.append(request)
        outcome = self.outcomes[min(self.i, len(self.outcomes) - 1)]
        self.i += 1
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


async def _async_no_sleep(_):
    pass


async def test_async_retries_503_then_succeeds():
    sender = _AsyncSender([_response(503), _response(200)])
    req = httpx.Request("GET", "http://api.test/sandboxes")
    res = await retry_request_async(req, sender, retries=3, sleep=_async_no_sleep)
    assert res.status_code == 200
    assert len(sender.calls) == 2


async def test_async_post_not_retried_ambiguous():
    sender = _AsyncSender([_response(502)])
    req = httpx.Request("POST", "http://api.test/rpc", content=b"x")
    res = await retry_request_async(req, sender, retries=3, sleep=_async_no_sleep)
    assert res.status_code == 502
    assert len(sender.calls) == 1


# ---------------------------------------------------------------------------
# classification table (parity with JS src/retry.ts)
# ---------------------------------------------------------------------------


def test_retryable_status_table_matches_agreed_policy():
    assert _RETRYABLE_STATUS == {
        408: "ambiguous",
        429: "rejected",
        502: "ambiguous",
        503: "ambiguous",
        504: "ambiguous",
    }
    # 500 is intentionally not retryable.
    assert 500 not in _RETRYABLE_STATUS
