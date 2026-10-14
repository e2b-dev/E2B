import asyncio
import threading

import httpx
import pytest

from e2b.retry import (
    _AsyncResumedStream,
    _Peek,
    _ResumedStream,
    AsyncRetryableTransport,
    RetryableTransport,
    is_replayable,
    parse_retry_after,
)

JSON = {"Content-Type": "application/json"}


class FakeTransport(httpx.BaseTransport):
    def __init__(self, outcomes, retry_after="0"):
        self.outcomes = iter(outcomes)
        self.retry_after = retry_after
        self.requests = []
        self.responses = []
        self.closed = False

    def handle_request(self, request):
        self.requests.append(request)
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        response = httpx.Response(
            outcome,
            headers={"Retry-After": self.retry_after} if self.retry_after else {},
            content=b"response",
        )
        self.responses.append(response)
        return response

    def close(self):
        self.closed = True


class FakeAsyncTransport(httpx.AsyncBaseTransport):
    def __init__(self, outcomes, retry_after="0"):
        self.outcomes = iter(outcomes)
        self.retry_after = retry_after
        self.requests = []
        self.responses = []
        self.closed = False

    async def handle_async_request(self, request):
        self.requests.append(request)
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        response = httpx.Response(
            outcome,
            headers={"Retry-After": self.retry_after} if self.retry_after else {},
            content=b"response",
        )
        self.responses.append(response)
        return response

    async def aclose(self):
        self.closed = True


class FakeClock:
    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def monotonic(self):
        return self.now

    def sleep(self, delay):
        self.sleeps.append(delay)
        self.now += delay


def test_retries_rate_limit_after_server_delay_and_replays_body():
    inner = FakeTransport([429, 200], retry_after="2")
    sleeps = []
    request = httpx.Request("POST", "https://api.test", content=b"payload")

    response = RetryableTransport(inner, retries=3, sleep=sleeps.append).handle_request(
        request
    )

    assert response.status_code == 200
    assert sleeps == [2]
    assert [item.content for item in inner.requests] == [b"payload", b"payload"]
    assert inner.responses[0].is_closed


def test_exhaustion_returns_final_rate_limit_response():
    inner = FakeTransport([429, 429, 429])

    response = RetryableTransport(
        inner, retries=2, sleep=lambda _: None
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response is inner.responses[-1]
    assert len(inner.requests) == 3
    assert all(item.is_closed for item in inner.responses[:-1])
    assert response.content == b"response"


@pytest.mark.parametrize("retry_after", ["soon", "-1", "+1", "1.5"])
def test_does_not_retry_without_delta_seconds(retry_after):
    inner = FakeTransport([429], retry_after=retry_after)

    response = RetryableTransport(inner, retries=3).handle_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response.status_code == 429
    assert len(inner.requests) == 1


def test_429_without_retry_after_is_propagated_as_is():
    inner = FakeTransport([429], retry_after=None)

    response = RetryableTransport(inner, retries=3).handle_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1


def test_retry_after_exceeding_timeout_is_propagated_as_is():
    inner = FakeTransport([429], retry_after="4")
    sleeps = []
    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={"timeout": {"connect": 3.0, "read": 3.0}},
    )

    response = RetryableTransport(
        inner, retries=3, sleep=sleeps.append, monotonic=lambda: 0.0
    ).handle_request(request)

    assert response is inner.responses[0]
    assert len(inner.requests) == 1
    assert sleeps == []


def test_retry_wait_is_bounded_when_request_timeout_is_disabled():
    inner = FakeTransport([429], retry_after="60")
    sleeps = []
    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={
            "timeout": {"connect": None, "read": None, "write": None, "pool": None}
        },
    )

    response = RetryableTransport(
        inner, retries=3, sleep=sleeps.append, monotonic=lambda: 0.0
    ).handle_request(request)

    assert response is inner.responses[0]
    assert len(inner.requests) == 1
    assert sleeps == []


@pytest.mark.parametrize("status", [400, 404, 500, 504])
def test_does_not_retry_other_status_codes(status):
    inner = FakeTransport([status], retry_after="0")

    response = RetryableTransport(inner, retries=3).handle_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1


@pytest.mark.parametrize("status", [502, 503])
def test_retries_unavailable_status_with_exponential_backoff_and_jitter(status):
    inner = FakeTransport([status, status, status, 200], retry_after=None)
    sleeps = []
    randoms = iter([0.0, 1.0, 0.5])
    request = httpx.Request(
        "POST", "https://api.test/sandboxes/sbx-1/pause", content=b"payload"
    )

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=sleeps.append,
        monotonic=lambda: 0.0,
        random_=lambda: next(randoms),
    ).handle_request(request)

    assert response.status_code == 200
    assert sleeps == pytest.approx([0.05, 0.2, 0.3])
    assert [item.content for item in inner.requests] == [b"payload"] * 4
    assert all(item.is_closed for item in inner.responses[:-1])


@pytest.mark.parametrize(
    ("method", "path", "attempts"),
    [
        ("POST", "/sandboxes", 1),
        ("POST", "/secrets/secret-1", 1),
        ("POST", "/sandboxes/sbx-1/pause", 2),
        ("GET", "/sandboxes", 2),
    ],
)
def test_bad_gateway_is_retried_only_for_replayable_operations(method, path, attempts):
    inner = FakeTransport([502, 200], retry_after=None)

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(httpx.Request(method, f"https://api.test{path}", content=b"p"))

    assert response.status_code == (502 if attempts == 1 else 200)
    assert len(inner.requests) == attempts


class JsonTransport(httpx.BaseTransport):
    """Answers each request with the next (status, body) pair."""

    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)
        self.requests = []

    def handle_request(self, request):
        self.requests.append(request)
        status, body = next(self.outcomes)
        return httpx.Response(status, json=body)


class JsonAsyncTransport(httpx.AsyncBaseTransport):
    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)
        self.requests = []

    async def handle_async_request(self, request):
        self.requests.append(request)
        status, body = next(self.outcomes)
        return httpx.Response(status, json=body)


REFUSED = {"code": 503, "error_code": "sandbox_pause_refused", "message": "refused"}
CAPACITY = {"code": 503, "error_code": "sandbox_capacity_unavailable", "message": "no"}


def test_service_unavailable_with_a_non_retryable_error_code_is_returned_after_one_request():
    inner = JsonTransport([(503, REFUSED)])
    sleeps = []

    response = RetryableTransport(
        inner, retries=3, sleep=sleeps.append, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "sandbox_pause_refused"
    assert len(inner.requests) == 1
    assert sleeps == []


def test_service_unavailable_with_an_oversized_body_is_retried_without_reading_it():
    big = {"code": 503, "error_code": "sandbox_pause_refused", "message": "x" * 9000}
    inner = JsonTransport([(503, big), (200, {})])

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


class _ChunkedStream(httpx.SyncByteStream):
    """A 503 body of unknown length that records whether it was read."""

    def __init__(self, chunks, raise_=None):
        self.chunks = chunks
        self.raise_ = raise_
        self.read = False

    def __iter__(self):
        self.read = True
        if self.raise_ is not None:
            raise self.raise_
        yield from self.chunks


class _AsyncChunkedStream(httpx.AsyncByteStream):
    def __init__(self, chunks, raise_=None):
        self.chunks = chunks
        self.raise_ = raise_
        self.read = False

    async def __aiter__(self):
        self.read = True
        if self.raise_ is not None:
            raise self.raise_
        for chunk in self.chunks:
            yield chunk


class StreamTransport(httpx.BaseTransport):
    """Answers each request with the next prepared response factory."""

    def __init__(self, factories):
        self.factories = iter(factories)
        self.requests = []

    def handle_request(self, request):
        self.requests.append(request)
        return next(self.factories)(request)


class AsyncStreamTransport(httpx.AsyncBaseTransport):
    def __init__(self, factories):
        self.factories = iter(factories)
        self.requests = []

    async def handle_async_request(self, request):
        self.requests.append(request)
        return next(self.factories)(request)


def test_chunked_refusal_without_content_length_is_returned_after_one_request():
    body = _ChunkedStream([b'{"error_code":"sandbox_', b'pause_refused"}'])
    inner = StreamTransport(
        [
            lambda request: httpx.Response(503, stream=body, headers=JSON),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert len(inner.requests) == 1
    # The body read for the peek is still the caller's to read.
    assert response.json()["error_code"] == "sandbox_pause_refused"


async def test_async_chunked_refusal_without_content_length_is_returned_after_one_request():
    body = _AsyncChunkedStream([b'{"error_code":"sandbox_', b'pause_refused"}'])
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(503, stream=body, headers=JSON),
        ]
    )

    async def sleep(_):
        return None

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert len(inner.requests) == 1
    assert response.json()["error_code"] == "sandbox_pause_refused"


def test_oversized_chunked_body_is_retried():
    body = _ChunkedStream(
        [b'{"error_code":"sandbox_pause_refused","pad":"' + b"x" * 9000 + b'"}']
    )
    inner = StreamTransport(
        [
            lambda request: httpx.Response(503, stream=body, headers=JSON),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_non_json_503_body_is_retried_without_reading_it():
    body = _ChunkedStream([b"<html>busy</html>"])
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503, stream=body, headers={"Content-Type": "text/html"}
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert body.read is False


def test_content_type_is_matched_by_media_type_whatever_its_case_and_parameters():
    body = _ChunkedStream([b'{"error_code":"sandbox_pause_refused"}'])
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=body,
                headers={"Content-Type": "Application/JSON; charset=UTF-8"},
            ),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert len(inner.requests) == 1


def test_service_unavailable_whose_body_read_fails_is_retried():
    body = _ChunkedStream([], raise_=httpx.ReadTimeout("stalled"))
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=body,
                headers={"Content-Length": "40", "Content-Type": "application/json"},
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert body.read is True


async def test_async_service_unavailable_whose_body_read_fails_is_retried():
    body = _AsyncChunkedStream([], raise_=httpx.ReadTimeout("stalled"))
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=body,
                headers={"Content-Length": "40", "Content-Type": "application/json"},
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    async def sleep(_):
        return None

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert body.read is True


async def test_async_service_unavailable_with_a_refusal_body_of_known_length_is_returned():
    body = _AsyncChunkedStream([b'{"error_code":"sandbox_pause_refused"}'])
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=body,
                headers={"Content-Length": "38", "Content-Type": "application/json"},
            ),
        ]
    )

    async def sleep(_):
        return None

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert len(inner.requests) == 1


class _SlowStream(httpx.SyncByteStream):
    """A body whose read advances the fake clock, then yields or raises."""

    def __init__(self, clock, seconds, chunks, raise_=None):
        self.clock = clock
        self.seconds = seconds
        self.chunks = chunks
        self.raise_ = raise_

    def __iter__(self):
        self.clock.now += self.seconds
        if self.raise_ is not None:
            raise self.raise_
        yield from self.chunks


class _AsyncSlowStream(httpx.AsyncByteStream):
    def __init__(self, clock, seconds, chunks, raise_=None):
        self.clock = clock
        self.seconds = seconds
        self.chunks = chunks
        self.raise_ = raise_

    async def __aiter__(self):
        self.clock.now += self.seconds
        if self.raise_ is not None:
            raise self.raise_
        for chunk in self.chunks:
            yield chunk


BUDGET_1S = {"timeout": {"connect": None, "read": 1.0, "write": None, "pool": None}}


def test_failed_503_body_read_with_no_budget_left_reraises_the_read_error():
    clock = FakeClock()
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=_SlowStream(clock, 2.0, [], raise_=httpx.ReadTimeout("stalled")),
                headers={"Content-Length": "40", **JSON},
            ),
        ]
    )

    with pytest.raises(httpx.ReadTimeout, match="stalled"):
        RetryableTransport(
            inner, retries=3, sleep=clock.sleep, monotonic=clock.monotonic
        ).handle_request(
            httpx.Request(
                "POST",
                "https://api.test/sandboxes/sbx-1/pause",
                content=b"{}",
                extensions=BUDGET_1S,
            )
        )

    # The read outlived the 1 s budget: no retry, and the failed read is the
    # truthful outcome (no fabricated empty body for the API client to parse).
    assert len(inner.requests) == 1
    assert clock.sleeps == []


async def test_async_failed_503_body_read_with_no_budget_left_reraises_the_read_error():
    clock = FakeClock()
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=_AsyncSlowStream(
                    clock, 2.0, [], raise_=httpx.ReadTimeout("stalled")
                ),
                headers={"Content-Length": "40", **JSON},
            ),
        ]
    )

    async def sleep(delay):
        clock.sleep(delay)

    with pytest.raises(httpx.ReadTimeout, match="stalled"):
        await AsyncRetryableTransport(
            inner, retries=3, sleep=sleep, monotonic=clock.monotonic
        ).handle_async_request(
            httpx.Request(
                "POST",
                "https://api.test/sandboxes/sbx-1/pause",
                content=b"{}",
                extensions=BUDGET_1S,
            )
        )

    assert len(inner.requests) == 1
    assert clock.sleeps == []


def test_complete_503_body_read_with_no_budget_left_returns_it_with_the_body():
    clock = FakeClock()
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=_SlowStream(clock, 2.0, [b'{"code":503,"message":"busy"}']),
                headers={"Content-Length": "29", **JSON},
            ),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=clock.sleep, monotonic=clock.monotonic
    ).handle_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )

    assert response.status_code == 503
    assert response.json() == {"code": 503, "message": "busy"}
    assert len(inner.requests) == 1


# A refusal in three chunks; the third completes the JSON.
DRIP = [b'{"error_code":"sand', b"box_pause_", b'refused"}']
# The same refusal split so that the third chunk leaves the JSON open: a peek
# cut off there holds a prefix that does not parse, and hands the body on with
# a live tail.
OPEN_DRIP = [b'{"error_code":"sand', b"box_pause_", b'refused"', b"}"]


class _DripStream(httpx.SyncByteStream):
    """A body whose every chunk advances the fake clock; counts closes."""

    def __init__(self, clock, per_chunk, chunks):
        self.clock = clock
        self.per_chunk = per_chunk
        self.chunks = chunks
        self.closes = 0

    def __iter__(self):
        for chunk in self.chunks:
            self.clock.now += self.per_chunk
            yield chunk

    def close(self):
        self.closes += 1


class _AsyncDripStream(httpx.AsyncByteStream):
    def __init__(self, clock, per_chunk, chunks):
        self.clock = clock
        self.per_chunk = per_chunk
        self.chunks = chunks
        self.closes = 0

    async def __aiter__(self):
        for chunk in self.chunks:
            self.clock.now += self.per_chunk
            yield chunk

    async def aclose(self):
        self.closes += 1


async def test_async_peek_stops_after_its_wall_clock_budget_and_the_503_is_retried():
    clock = FakeClock()
    # The cut-off falls on the third chunk, which leaves the JSON open, so
    # the buffered prefix is not yet a refusal.
    chunks = OPEN_DRIP
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(
                503, stream=_AsyncDripStream(clock, 0.6, chunks), headers=JSON
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    async def sleep(delay):
        clock.sleep(delay)

    response = await AsyncRetryableTransport(
        inner,
        retries=3,
        sleep=sleep,
        monotonic=clock.monotonic,
        random_=lambda: 0.0,
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    # 1.2 s into a 1 s peek budget the read stops with the JSON still open:
    # not a refusal, retried.
    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_peek_stops_after_its_wall_clock_budget_and_the_503_is_retried():
    clock = FakeClock()
    # The cut-off falls on the third chunk, which leaves the JSON open, so
    # the buffered prefix is not yet a refusal.
    chunks = OPEN_DRIP
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503, stream=_DripStream(clock, 0.6, chunks), headers=JSON
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=clock.sleep,
        monotonic=clock.monotonic,
        random_=lambda: 0.0,
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    # 1.2 s into a 1 s peek budget the read stops with the JSON still open:
    # not a refusal, retried.
    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_read_cut_off_by_the_budget_with_no_budget_left_hands_the_503_on_whole():
    clock = FakeClock()
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503, stream=_DripStream(clock, 0.6, DRIP), headers=JSON
            ),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=clock.sleep, monotonic=clock.monotonic
    ).handle_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )

    # Three chunks at 0.6 s against a 1 s budget: the third wait began past
    # it and the request budget is gone too, so the 503 is the outcome and its
    # body is handed on whole (peeked chunks, then the rest of the stream), as
    # the JavaScript side does.
    assert response.status_code == 503
    assert response.read() == b"".join(DRIP)
    assert response.json()["error_code"] == "sandbox_pause_refused"
    assert len(inner.requests) == 1
    assert clock.sleeps == []


async def test_async_read_cut_off_by_the_budget_with_no_budget_left_hands_the_503_on_whole():
    clock = FakeClock()
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(
                503, stream=_AsyncDripStream(clock, 0.6, DRIP), headers=JSON
            ),
        ]
    )

    async def sleep(delay):
        clock.sleep(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=clock.monotonic
    ).handle_async_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )

    assert response.status_code == 503
    assert (await response.aread()) == b"".join(DRIP)
    assert response.json()["error_code"] == "sandbox_pause_refused"
    assert len(inner.requests) == 1
    assert clock.sleeps == []


async def test_async_complete_503_body_read_with_no_budget_left_returns_it_with_the_body():
    clock = FakeClock()
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=_AsyncSlowStream(clock, 2.0, [b'{"code":503,"message":"busy"}']),
                headers={"Content-Length": "29", **JSON},
            ),
        ]
    )

    async def sleep(delay):
        clock.sleep(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=clock.monotonic
    ).handle_async_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )

    assert response.status_code == 503
    assert response.json() == {"code": 503, "message": "busy"}
    assert len(inner.requests) == 1


BIG_REFUSAL = (
    b'{"code":503,"error_code":"sandbox_pause_refused","message":"'
    + b"x" * 9000
    + b'"}'
)
# The cap (8 KiB) is passed on the second chunk; the third is only ever read by
# the resumed stream's live-iterator replay.
BIG_CHUNKS = [BIG_REFUSAL[:4200], BIG_REFUSAL[4200:8400], BIG_REFUSAL[8400:]]
STREAMED_JSON = {**JSON, "Transfer-Encoding": "chunked"}


def test_over_cap_body_with_no_budget_left_is_handed_on_up_to_the_deadline():
    clock = FakeClock()
    body = _DripStream(clock, 0.5, BIG_CHUNKS)
    inner = StreamTransport(
        [lambda request: httpx.Response(503, stream=body, headers=STREAMED_JSON)]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=clock.sleep, monotonic=clock.monotonic
    ).handle_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )

    # Past the byte cap on the second chunk (0.5 s per chunk keeps every wait
    # within the 1 s peek budget, so only the cap stops the peek). The peek's
    # time counts against the retry delay, so a budget exhausted after it
    # means the clock is at the request deadline: the 503 is handed on, the
    # stream-form rebuild carries neither a stale length nor the transfer
    # encoding, the peeked chunks are replayed, and the tail is not waited
    # for past the deadline.
    assert response.status_code == 503
    assert "content-length" not in response.headers
    assert "transfer-encoding" not in response.headers
    chunks = response.iter_bytes()
    assert [next(chunks), next(chunks)] == BIG_CHUNKS[:2]
    with pytest.raises(httpx.ReadTimeout, match="reading the response body"):
        next(chunks)
    assert body.closes == 1
    assert len(inner.requests) == 1


async def test_async_over_cap_body_with_no_budget_left_is_handed_on_up_to_the_deadline():
    clock = FakeClock()
    body = _AsyncDripStream(clock, 0.5, BIG_CHUNKS)
    inner = AsyncStreamTransport(
        [lambda request: httpx.Response(503, stream=body, headers=STREAMED_JSON)]
    )

    async def sleep(delay):
        clock.sleep(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=clock.monotonic
    ).handle_async_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )

    assert response.status_code == 503
    assert "content-length" not in response.headers
    assert "transfer-encoding" not in response.headers
    received = []
    with pytest.raises(httpx.ReadTimeout, match="reading the response body"):
        async for chunk in response.aiter_bytes():
            received.append(chunk)
    assert received == BIG_CHUNKS[:2]
    assert body.closes == 1
    assert len(inner.requests) == 1


DEEP = b"[" * 3000


def test_a_503_body_nested_too_deep_to_parse_is_not_a_refusal_and_is_retried():
    inner = StreamTransport(
        [
            lambda request: httpx.Response(503, content=DEEP, headers=JSON),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    # json.loads raises RecursionError here, not ValueError; the peek must
    # swallow it like any unparsable body.
    assert response.status_code == 200
    assert len(inner.requests) == 2


async def test_async_a_503_body_nested_too_deep_to_parse_is_not_a_refusal_and_is_retried():
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(503, content=DEEP, headers=JSON),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    async def sleep(_):
        return None

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


class _GatedStream(httpx.SyncByteStream):
    """Sync twin of ``_GatedAsyncStream`` on threading events."""

    def __init__(self, chunks, gate_before, clock=None, per_chunk=0.0):
        self.chunks = chunks
        self.gate_before = gate_before
        self.clock = clock
        self.per_chunk = per_chunk
        self.gate = threading.Event()
        self.waiting = threading.Event()
        self.closes = 0

    def __iter__(self):
        for index, chunk in enumerate(self.chunks):
            if index == self.gate_before:
                self.waiting.set()
                self.gate.wait()
            if self.clock is not None:
                self.clock.now += self.per_chunk
            yield chunk

    def close(self):
        self.closes += 1


def test_closing_the_resumed_response_while_a_reader_thread_iterates_closes_the_inner_once():
    # Built directly with the deadline ahead: through the transport a hand-on
    # happens at the deadline, where the tail is never waited for.
    body = _GatedStream(OPEN_DRIP, gate_before=3)
    inner = httpx.Response(503, stream=body, headers=JSON)
    rest = inner.iter_bytes()
    peek = _Peek(buffered=[next(rest)], rest=rest)
    request = httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause")
    response = httpx.Response(
        503,
        stream=_ResumedStream(inner, peek, request, float("inf"), lambda: 0.0),
        request=request,
    )

    received = []
    reader = threading.Thread(
        target=lambda: received.extend(response.iter_bytes()), daemon=True
    )
    reader.start()
    assert body.waiting.wait(5)

    # The reader is inside the live generator (awaiting the fourth chunk);
    # closing it from here raises ValueError("generator already executing"),
    # which close() tolerates while still closing the inner exactly once.
    response.close()
    assert body.closes == 1

    body.gate.set()
    reader.join(5)
    assert not reader.is_alive()
    assert b"".join(received) == b"".join(OPEN_DRIP)
    assert body.closes == 1


UNHASHABLE_CODE = {
    "code": 503,
    "error_code": ["sandbox_pause_refused"],
    "message": "a proxy rewrote the body",
}


def test_a_503_whose_error_code_is_not_a_string_is_not_a_refusal_and_is_retried():
    inner = StreamTransport(
        [
            lambda request: httpx.Response(503, json=UNHASHABLE_CODE),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    # A list is unhashable: without the string guard the membership test
    # raised TypeError out of the transport.
    assert response.status_code == 200
    assert len(inner.requests) == 2


async def test_async_a_503_whose_error_code_is_not_a_string_is_not_a_refusal_and_is_retried():
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(503, json=UNHASHABLE_CODE),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    async def sleep(_):
        return None

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_a_cut_off_peek_whose_buffered_chunks_form_the_refusal_returns_it_without_retrying():
    clock = FakeClock()
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503, stream=_DripStream(clock, 0.6, DRIP), headers=JSON
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=clock.sleep,
        monotonic=clock.monotonic,
        random_=lambda: 0.0,
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    # The third chunk's wait began past the 1 s budget, but it was the last
    # one: the buffered bytes are the whole refusal, so no retry is needed
    # although budget remains.
    assert response.status_code == 503
    assert response.json()["error_code"] == "sandbox_pause_refused"
    assert len(inner.requests) == 1
    assert clock.sleeps == []


async def test_async_a_cut_off_peek_whose_buffered_chunks_form_the_refusal_returns_it_without_retrying():
    clock = FakeClock()
    inner = AsyncStreamTransport(
        [
            lambda request: httpx.Response(
                503, stream=_AsyncDripStream(clock, 0.6, DRIP), headers=JSON
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    async def sleep(delay):
        clock.sleep(delay)

    response = await AsyncRetryableTransport(
        inner,
        retries=3,
        sleep=sleep,
        monotonic=clock.monotonic,
        random_=lambda: 0.0,
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "sandbox_pause_refused"
    assert len(inner.requests) == 1
    assert clock.sleeps == []


class _GatedAsyncStream(httpx.AsyncByteStream):
    """Yields ``chunks`` advancing the clock per chunk, but waits on ``gate``
    before the chunk at ``gate_before``; counts closes."""

    def __init__(self, chunks, gate_before, clock=None, per_chunk=0.0):
        self.chunks = chunks
        self.gate_before = gate_before
        self.clock = clock
        self.per_chunk = per_chunk
        self.gate = asyncio.Event()
        self.waiting = asyncio.Event()
        self.closes = 0

    async def __aiter__(self):
        for index, chunk in enumerate(self.chunks):
            if index == self.gate_before:
                self.waiting.set()
                await self.gate.wait()
            if self.clock is not None:
                self.clock.now += self.per_chunk
            yield chunk

    async def aclose(self):
        self.closes += 1


async def test_async_cancellation_during_the_peek_closes_the_inner_response_once():
    body = _GatedAsyncStream(
        [b'{"code":503,"error_code":"sand', b'box_pause_refused","message":"r"}'],
        gate_before=1,
    )
    inner = AsyncStreamTransport(
        [lambda request: httpx.Response(503, stream=body, headers=JSON)]
    )

    async def sleep(_):
        return None

    task = asyncio.create_task(
        AsyncRetryableTransport(
            inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
        ).handle_async_request(
            httpx.Request(
                "POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}"
            )
        )
    )
    await body.waiting.wait()
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task

    # The peek was awaiting the second chunk; the inner response is closed
    # exactly once and the cancellation propagates.
    assert body.closes == 1


async def test_async_closing_the_resumed_response_while_a_reader_awaits_closes_the_inner_once():
    body = _GatedAsyncStream(OPEN_DRIP, gate_before=3)
    inner = httpx.Response(503, stream=body, headers=JSON)
    rest = inner.aiter_bytes()
    peek = _Peek(buffered=[await rest.__anext__()], rest=rest)
    request = httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause")
    response = httpx.Response(
        503,
        stream=_AsyncResumedStream(inner, peek, request, float("inf"), lambda: 0.0),
        request=request,
    )

    received = []

    async def read():
        async for chunk in response.aiter_bytes():
            received.append(chunk)

    reader = asyncio.create_task(read())
    await body.waiting.wait()

    # A second task closes while the reader awaits the fourth chunk inside the
    # running generator: that generator cannot be closed from outside, and the
    # inner response is still closed, exactly once.
    await response.aclose()
    assert body.closes == 1

    body.gate.set()
    await reader
    assert b"".join(received) == b"".join(OPEN_DRIP)
    assert body.closes == 1


def test_handed_on_tail_is_bounded_by_the_request_deadline():
    clock = FakeClock()
    body = _DripStream(clock, 0.6, OPEN_DRIP)
    inner = StreamTransport(
        [lambda request: httpx.Response(503, stream=body, headers=JSON)]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=clock.sleep, monotonic=clock.monotonic
    ).handle_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )
    assert response.status_code == 503

    # The three peeked chunks are replayed; the fourth would be waited for
    # past the deadline, so the read ends with a timeout there.
    chunks = response.iter_bytes()
    assert [next(chunks) for _ in range(3)] == OPEN_DRIP[:3]
    with pytest.raises(httpx.ReadTimeout, match="reading the response body"):
        next(chunks)
    assert body.closes == 1


async def test_async_handed_on_tail_is_bounded_by_the_request_deadline():
    clock = FakeClock()
    body = _AsyncDripStream(clock, 0.6, OPEN_DRIP)
    inner = AsyncStreamTransport(
        [lambda request: httpx.Response(503, stream=body, headers=JSON)]
    )

    async def sleep(delay):
        clock.sleep(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=clock.monotonic
    ).handle_async_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )
    assert response.status_code == 503

    received = []
    with pytest.raises(httpx.ReadTimeout, match="reading the response body"):
        async for chunk in response.aiter_bytes():
            received.append(chunk)
    assert received == OPEN_DRIP[:3]
    assert body.closes == 1


BUSY_DRIP = [b'{"code":503,"message":"bu', b"sy", b'"}', b"\n"]


def test_a_complete_busy_body_in_the_cut_off_chunk_is_retried_without_reading_the_tail():
    clock = FakeClock()
    body = _DripStream(clock, 0.6, BUSY_DRIP)
    inner = StreamTransport(
        [
            lambda request: httpx.Response(503, stream=body, headers=JSON),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=clock.sleep,
        monotonic=clock.monotonic,
        random_=lambda: 0.0,
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    # The third chunk's wait began past the budget but completed the JSON: a
    # plain busy 503 read in full, retried like any other with the tail left.
    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert body.closes == 1


def test_a_complete_busy_body_in_the_cut_off_chunk_with_no_budget_left_is_returned_whole():
    clock = FakeClock()
    body = _DripStream(clock, 0.6, BUSY_DRIP)
    inner = StreamTransport(
        [lambda request: httpx.Response(503, stream=body, headers=JSON)]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=clock.sleep, monotonic=clock.monotonic
    ).handle_request(
        httpx.Request(
            "POST",
            "https://api.test/sandboxes/sbx-1/pause",
            content=b"{}",
            extensions=BUDGET_1S,
        )
    )

    assert response.status_code == 503
    assert response.json() == {"code": 503, "message": "busy"}
    assert len(inner.requests) == 1
    assert body.closes == 1


def test_rebuilt_refusal_drops_transfer_headers_and_native_extensions():
    body = _ChunkedStream([b'{"error_code":"sandbox_pause_refused"}'])
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=body,
                headers={**JSON, "Transfer-Encoding": "chunked", "X-Keep": "1"},
                extensions={
                    "http_version": b"HTTP/2",
                    "get_trailers": lambda: {"bound": "to the closed response"},
                },
            ),
        ]
    )

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert "transfer-encoding" not in response.headers
    assert response.headers["x-keep"] == "1"
    assert response.extensions == {"http_version": b"HTTP/2"}
    assert response.request.url.path == "/sandboxes/sbx-1/pause"


def test_time_spent_reading_the_503_body_counts_towards_the_delay():
    clock = FakeClock()
    inner = StreamTransport(
        [
            lambda request: httpx.Response(
                503,
                stream=_SlowStream(clock, 0.02, [b'{"code":503}']),
                headers={"Content-Length": "12", "Content-Type": "application/json"},
            ),
            lambda request: httpx.Response(200, json={}),
        ]
    )

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=clock.sleep,
        monotonic=clock.monotonic,
        random_=lambda: 0.0,
    ).handle_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    # Backoff 0.05 s at attempt 0, minus the 0.02 s the read took.
    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert clock.sleeps == [pytest.approx(0.03)]


def test_service_unavailable_with_another_error_code_is_retried():
    inner = JsonTransport([(503, CAPACITY), (200, {})])

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(httpx.Request("POST", "https://api.test/sandboxes", content=b"p"))

    assert response.status_code == 200
    assert len(inner.requests) == 2


async def test_async_service_unavailable_with_a_non_retryable_error_code_is_returned_after_one_request():
    inner = JsonAsyncTransport([(503, REFUSED)])
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/sandboxes/sbx-1/pause", content=b"{}")
    )

    assert response.status_code == 503
    assert response.json()["error_code"] == "sandbox_pause_refused"
    assert len(inner.requests) == 1
    assert sleeps == []


def test_service_unavailable_is_retried_for_non_replayable_operation():
    inner = FakeTransport([503, 200], retry_after=None)

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(httpx.Request("POST", "https://api.test/sandboxes", content=b"p"))

    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_backoff_is_capped_for_long_retry_sequences():
    inner = FakeTransport([503] * 9, retry_after=None)
    sleeps = []
    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={"timeout": {"connect": None, "read": None}},
    )

    RetryableTransport(
        inner,
        retries=8,
        sleep=sleeps.append,
        monotonic=lambda: 0.0,
        random_=lambda: 1.0,
    ).handle_request(request)

    assert sleeps == pytest.approx([0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.4, 10.0])


def test_unavailable_status_prefers_retry_after_over_backoff():
    inner = FakeTransport([503, 200], retry_after="3")
    sleeps = []

    def random_():
        raise AssertionError("backoff should not be used")

    response = RetryableTransport(
        inner, retries=3, sleep=sleeps.append, random_=random_
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert sleeps == [3]


def test_unavailable_status_exhaustion_returns_final_response():
    inner = FakeTransport([503, 503, 503], retry_after=None)

    response = RetryableTransport(
        inner, retries=2, sleep=lambda _: None, random_=lambda: 0.0
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response is inner.responses[-1]
    assert len(inner.requests) == 3
    assert response.content == b"response"


def test_backoff_exceeding_timeout_is_propagated_as_is():
    inner = FakeTransport([502], retry_after=None)
    sleeps = []
    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={"timeout": {"connect": 0.08, "read": 0.08}},
    )

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=sleeps.append,
        monotonic=lambda: 0.0,
        random_=lambda: 1.0,
    ).handle_request(request)

    assert response is inner.responses[0]
    assert sleeps == []


def test_does_not_retry_when_cumulative_wait_reaches_request_timeout():
    inner = FakeTransport([429, 429], retry_after="2")
    clock = FakeClock()
    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={
            "timeout": {"connect": 3.0, "read": 3.0, "write": 3.0, "pool": 3.0}
        },
    )

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=clock.sleep,
        monotonic=clock.monotonic,
    ).handle_request(request)

    assert response.status_code == 429
    assert clock.sleeps == [2]
    assert len(inner.requests) == 2


def test_timeout_after_retry_wait_names_configuration_options():
    inner = FakeTransport([429])
    clock = FakeClock()

    def sleep(delay):
        clock.sleeps.append(delay)
        clock.now = 4.0

    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={"timeout": {"read": 3.0}},
    )

    with pytest.raises(httpx.TimeoutException, match=r"request_timeout.*retries"):
        RetryableTransport(
            inner,
            retries=1,
            sleep=sleep,
            monotonic=clock.monotonic,
        ).handle_request(request)


def test_retry_uses_only_the_remaining_request_timeout():
    clock = FakeClock()

    class AdvancingTransport(FakeTransport):
        def handle_request(self, request):
            response = super().handle_request(request)
            if len(self.requests) == 1:
                clock.now = 2.0
            return response

    inner = AdvancingTransport([429, 200])
    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={"timeout": {"connect": 3.0, "read": 3.0}},
    )

    response = RetryableTransport(
        inner, retries=1, sleep=clock.sleep, monotonic=clock.monotonic
    ).handle_request(request)

    assert response.status_code == 200
    assert inner.requests[1].extensions["timeout"] == {
        "connect": 1.0,
        "read": 1.0,
    }


def test_retry_preserves_remaining_budget_for_each_timeout_phase():
    clock = FakeClock()

    class AdvancingTransport(FakeTransport):
        def handle_request(self, request):
            response = super().handle_request(request)
            if len(self.requests) == 1:
                clock.now = 2.0
            return response

    inner = AdvancingTransport([429, 200])
    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={
            "timeout": {"connect": 3.0, "read": 3.0, "write": 3.0, "pool": 3.0}
        },
    )

    RetryableTransport(
        inner, retries=1, sleep=clock.sleep, monotonic=clock.monotonic
    ).handle_request(request)

    assert inner.requests[1].extensions["timeout"] == {
        "connect": 1.0,
        "read": 1.0,
        "write": 1.0,
        "pool": 1.0,
    }


def test_zero_retries_passes_the_original_request_through():
    inner = FakeTransport([429], retry_after="0")
    request = httpx.Request("GET", "https://api.test")

    response = RetryableTransport(inner, retries=0).handle_request(request)

    assert response.status_code == 429
    assert inner.requests == [request]


def test_does_not_buffer_or_retry_streamed_body():
    class Stream(httpx.SyncByteStream):
        def __iter__(self):
            yield b"payload"

    inner = FakeTransport([429])
    request = httpx.Request("POST", "https://api.test", content=Stream())

    response = RetryableTransport(inner, retries=3).handle_request(request)

    assert response.status_code == 429
    assert inner.requests == [request]


def test_close_leaves_cached_transport_open():
    inner = FakeTransport([])

    RetryableTransport(inner, retries=1).close()

    assert not inner.closed


NON_REPLAYABLE = [
    ("POST", "/sandboxes"),
    ("POST", "/v2/sandboxes"),
    ("POST", "/sandboxes/sbx-1/fork"),
    ("POST", "/sandboxes/sbx-1/snapshots"),
    ("POST", "/api-keys"),
    ("POST", "/admin/teams/team-1/api-keys"),
    ("POST", "/volumes"),
    ("POST", "/secrets"),
    ("POST", "/secrets/secret-1"),
    ("POST", "/events/webhooks"),
    # POSTs not on the allowlist: unknown and near-miss paths
    ("POST", "/sandboxes/sbx-1/pause/extra"),
    ("POST", "/sandboxes/a/b/pause"),
    ("POST", "/templates/tags/extra"),
    ("POST", "/new-resources"),
]

REPLAYABLE = [
    ("GET", "/sandboxes"),
    ("GET", "/sandboxes/sbx-1"),
    ("DELETE", "/sandboxes/sbx-1"),
    ("POST", "/sandboxes/sbx-1/pause"),
    ("POST", "/sandboxes/sbx-1/resume"),
    ("POST", "/sandboxes/sbx-1/connect"),
    ("POST", "/v2/sandboxes/sbx-1/connect"),
    ("POST", "/sandboxes/sbx-1/timeout"),
    ("POST", "/sandboxes/sbx-1/refreshes"),
    ("PUT", "/sandboxes/sbx-1/network"),
    ("PATCH", "/templates/tpl-1"),
    ("POST", "/v3/templates"),
    ("POST", "/v2/templates/tpl-1/builds/build-1"),
    ("POST", "/templates/tags"),
    ("DELETE", "/templates/tags"),
    ("POST", "/nodes/node-1"),
    ("POST", "/admin/teams/team-1/sandboxes/kill"),
    ("POST", "/admin/teams/team-1/builds/cancel"),
    ("DELETE", "/volumes/vol-1"),
    ("PATCH", "/events/webhooks/hook-1"),
]

NETWORK_ERRORS = [
    httpx.ReadError("connection reset"),
    httpx.WriteError("broken pipe"),
    httpx.RemoteProtocolError("stream reset"),
]


@pytest.mark.parametrize(("method", "path"), NON_REPLAYABLE)
def test_unlisted_posts_are_not_replayable(method, path):
    assert not is_replayable(httpx.Request(method, f"https://api.test{path}?x=1"))


@pytest.mark.parametrize(("method", "path"), REPLAYABLE)
def test_other_operations_are_replayable(method, path):
    assert is_replayable(httpx.Request(method, f"https://api.test{path}?x=1"))


@pytest.mark.parametrize(("method", "path"), REPLAYABLE[:5])
def test_retries_network_error_for_replayable_operation(method, path):
    inner = FakeTransport([NETWORK_ERRORS[0], NETWORK_ERRORS[2], 200])
    sleeps = []

    response = RetryableTransport(
        inner,
        retries=3,
        sleep=sleeps.append,
        monotonic=lambda: 0.0,
        random_=lambda: 1.0,
    ).handle_request(httpx.Request(method, f"https://api.test{path}", content=b"p"))

    assert response.status_code == 200
    assert sleeps == pytest.approx([0.1, 0.2])
    assert [item.content for item in inner.requests] == [b"p"] * 3


@pytest.mark.parametrize("error", NETWORK_ERRORS)
@pytest.mark.parametrize(("method", "path"), NON_REPLAYABLE[:3])
def test_does_not_retry_network_error_for_non_replayable_operation(error, method, path):
    inner = FakeTransport([error, 200])

    with pytest.raises(type(error)):
        RetryableTransport(inner, retries=3, sleep=lambda _: None).handle_request(
            httpx.Request(method, f"https://api.test{path}", content=b"p")
        )

    assert len(inner.requests) == 1


@pytest.mark.parametrize(
    "error",
    [
        httpx.ConnectError("refused"),
        httpx.ConnectTimeout("timed out"),
        httpx.ReadTimeout("timed out"),
        httpx.LocalProtocolError("bad request"),
    ],
)
def test_leaves_connect_errors_and_timeouts_to_the_layers_around(error):
    inner = FakeTransport([error, 200])

    with pytest.raises(type(error)):
        RetryableTransport(inner, retries=3, sleep=lambda _: None).handle_request(
            httpx.Request("GET", "https://api.test/sandboxes")
        )

    assert len(inner.requests) == 1


def test_rethrows_network_error_after_exhausting_retries():
    inner = FakeTransport([httpx.ReadError("reset")] * 3)

    with pytest.raises(httpx.ReadError):
        RetryableTransport(
            inner, retries=2, sleep=lambda _: None, monotonic=lambda: 0.0
        ).handle_request(httpx.Request("GET", "https://api.test/sandboxes"))

    assert len(inner.requests) == 3


def test_rethrows_network_error_when_backoff_would_exceed_request_timeout():
    inner = FakeTransport([httpx.ReadError("reset"), 200])
    sleeps = []

    with pytest.raises(httpx.ReadError):
        RetryableTransport(
            inner,
            retries=3,
            sleep=sleeps.append,
            monotonic=lambda: 0.0,
            random_=lambda: 1.0,
        ).handle_request(
            httpx.Request(
                "GET",
                "https://api.test/sandboxes",
                extensions={"timeout": {"connect": 0.08, "read": 0.08}},
            )
        )

    assert len(inner.requests) == 1
    assert sleeps == []


@pytest.mark.asyncio
async def test_async_retries_rate_limit_and_replays_body():
    inner = FakeAsyncTransport([429, 200], retry_after="2")
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep
    ).handle_async_request(
        httpx.Request("POST", "https://api.test", content=b"payload")
    )

    assert response.status_code == 200
    assert sleeps == [2]
    assert [item.content for item in inner.requests] == [b"payload", b"payload"]
    assert inner.responses[0].is_closed


@pytest.mark.asyncio
async def test_async_does_not_retry_when_wait_reaches_request_timeout():
    inner = FakeAsyncTransport([429], retry_after="3")
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request(
            "GET",
            "https://api.test",
            extensions={"timeout": {"read": 3.0}},
        )
    )

    assert response.status_code == 429
    assert sleeps == []
    assert len(inner.requests) == 1


@pytest.mark.asyncio
async def test_async_timeout_after_retry_wait_names_configuration_options():
    inner = FakeAsyncTransport([429])
    clock = FakeClock()

    async def sleep(delay):
        clock.sleeps.append(delay)
        clock.now = 4.0

    request = httpx.Request(
        "GET",
        "https://api.test",
        extensions={"timeout": {"read": 3.0}},
    )

    with pytest.raises(httpx.TimeoutException, match=r"request_timeout.*retries"):
        await AsyncRetryableTransport(
            inner,
            retries=1,
            sleep=sleep,
            monotonic=clock.monotonic,
        ).handle_async_request(request)


@pytest.mark.asyncio
async def test_async_retries_unavailable_status_with_backoff():
    inner = FakeAsyncTransport([503, 502, 200], retry_after=None)
    sleeps = []
    randoms = iter([0.0, 1.0])

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner,
        retries=3,
        sleep=sleep,
        monotonic=lambda: 0.0,
        random_=lambda: next(randoms),
    ).handle_async_request(
        httpx.Request(
            "POST", "https://api.test/sandboxes/sbx-1/pause", content=b"payload"
        )
    )

    assert response.status_code == 200
    assert sleeps == pytest.approx([0.05, 0.2])
    assert [item.content for item in inner.requests] == [b"payload"] * 3
    assert all(item.is_closed for item in inner.responses[:-1])


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("method", "path", "attempts"),
    [
        ("POST", "/sandboxes", 1),
        ("POST", "/secrets/secret-1", 1),
        ("POST", "/sandboxes/sbx-1/pause", 2),
        ("GET", "/sandboxes", 2),
    ],
)
async def test_async_bad_gateway_is_retried_only_for_replayable_operations(
    method, path, attempts
):
    inner = FakeAsyncTransport([502, 200], retry_after=None)

    async def sleep(_):
        pass

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request(method, f"https://api.test{path}", content=b"p")
    )

    assert response.status_code == (502 if attempts == 1 else 200)
    assert len(inner.requests) == attempts


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [400, 404, 500, 504])
async def test_async_does_not_retry_other_status_codes(status):
    inner = FakeAsyncTransport([status], retry_after="0")

    response = await AsyncRetryableTransport(inner, retries=3).handle_async_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1


@pytest.mark.asyncio
async def test_async_429_without_retry_after_is_propagated_as_is():
    inner = FakeAsyncTransport([429], retry_after=None)

    response = await AsyncRetryableTransport(inner, retries=3).handle_async_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1


@pytest.mark.asyncio
async def test_async_retry_after_exceeding_timeout_is_propagated_as_is():
    inner = FakeAsyncTransport([429], retry_after="4")
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request(
            "GET",
            "https://api.test",
            extensions={"timeout": {"connect": 3.0, "read": 3.0}},
        )
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1
    assert sleeps == []


@pytest.mark.asyncio
async def test_async_retry_wait_is_bounded_when_request_timeout_is_disabled():
    inner = FakeAsyncTransport([429], retry_after="60")
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request(
            "GET",
            "https://api.test",
            extensions={
                "timeout": {
                    "connect": None,
                    "read": None,
                    "write": None,
                    "pool": None,
                }
            },
        )
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1
    assert sleeps == []


@pytest.mark.asyncio
async def test_async_retry_uses_only_the_remaining_request_timeout():
    clock = FakeClock()

    class AdvancingTransport(FakeAsyncTransport):
        async def handle_async_request(self, request):
            response = await super().handle_async_request(request)
            if len(self.requests) == 1:
                clock.now = 2.0
            return response

    inner = AdvancingTransport([429, 200])

    async def sleep(delay):
        clock.sleep(delay)

    response = await AsyncRetryableTransport(
        inner, retries=1, sleep=sleep, monotonic=clock.monotonic
    ).handle_async_request(
        httpx.Request(
            "GET",
            "https://api.test",
            extensions={"timeout": {"connect": 3.0, "read": 3.0}},
        )
    )

    assert response.status_code == 200
    assert inner.requests[1].extensions["timeout"] == {
        "connect": 1.0,
        "read": 1.0,
    }


@pytest.mark.asyncio
async def test_async_retry_preserves_remaining_budget_for_each_timeout_phase():
    clock = FakeClock()

    class AdvancingTransport(FakeAsyncTransport):
        async def handle_async_request(self, request):
            response = await super().handle_async_request(request)
            if len(self.requests) == 1:
                clock.now = 2.0
            return response

    inner = AdvancingTransport([429, 200])

    async def sleep(delay):
        clock.sleep(delay)

    await AsyncRetryableTransport(
        inner, retries=1, sleep=sleep, monotonic=clock.monotonic
    ).handle_async_request(
        httpx.Request(
            "GET",
            "https://api.test",
            extensions={
                "timeout": {
                    "connect": 3.0,
                    "read": 3.0,
                    "write": 3.0,
                    "pool": 3.0,
                }
            },
        )
    )

    assert inner.requests[1].extensions["timeout"] == {
        "connect": 1.0,
        "read": 1.0,
        "write": 1.0,
        "pool": 1.0,
    }


@pytest.mark.asyncio
async def test_async_does_not_retry_streamed_body():
    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b"payload"

    inner = FakeAsyncTransport([429])
    request = httpx.Request("POST", "https://api.test", content=Stream())

    response = await AsyncRetryableTransport(inner, retries=3).handle_async_request(
        request
    )

    assert response.status_code == 429
    assert inner.requests == [request]


@pytest.mark.asyncio
async def test_async_close_leaves_cached_transport_open():
    inner = FakeAsyncTransport([])

    await AsyncRetryableTransport(inner, retries=1).aclose()

    assert not inner.closed


@pytest.mark.asyncio
@pytest.mark.parametrize(("method", "path"), REPLAYABLE[:5])
async def test_async_retries_network_error_for_replayable_operation(method, path):
    inner = FakeAsyncTransport([NETWORK_ERRORS[0], NETWORK_ERRORS[2], 200])
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner,
        retries=3,
        sleep=sleep,
        monotonic=lambda: 0.0,
        random_=lambda: 1.0,
    ).handle_async_request(
        httpx.Request(method, f"https://api.test{path}", content=b"p")
    )

    assert response.status_code == 200
    assert sleeps == pytest.approx([0.1, 0.2])
    assert [item.content for item in inner.requests] == [b"p"] * 3


@pytest.mark.asyncio
@pytest.mark.parametrize("error", NETWORK_ERRORS)
@pytest.mark.parametrize(("method", "path"), NON_REPLAYABLE[:3])
async def test_async_does_not_retry_network_error_for_non_replayable_operation(
    error, method, path
):
    inner = FakeAsyncTransport([error, 200])

    async def sleep(_):
        pass

    with pytest.raises(type(error)):
        await AsyncRetryableTransport(
            inner, retries=3, sleep=sleep
        ).handle_async_request(
            httpx.Request(method, f"https://api.test{path}", content=b"p")
        )

    assert len(inner.requests) == 1


@pytest.mark.asyncio
async def test_async_rethrows_network_error_after_exhausting_retries():
    inner = FakeAsyncTransport([httpx.ReadError("reset")] * 3)

    async def sleep(_):
        pass

    with pytest.raises(httpx.ReadError):
        await AsyncRetryableTransport(
            inner, retries=2, sleep=sleep, monotonic=lambda: 0.0
        ).handle_async_request(httpx.Request("GET", "https://api.test/sandboxes"))

    assert len(inner.requests) == 3


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("0", 0),
        (" 60 ", 60),
        ("2147483648", None),
        ("9" * 10_000, None),
        ("Wed, 21 Oct 2015 07:28:00 GMT", None),
    ],
)
def test_parse_retry_after_delta_seconds(value, expected):
    assert parse_retry_after(value) == expected
