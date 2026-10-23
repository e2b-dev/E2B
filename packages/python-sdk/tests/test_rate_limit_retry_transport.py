import httpx
import pytest

from e2b.retry import (
    AsyncRetryableTransport,
    RetryableTransport,
    parse_retry_after,
)


class FakeTransport(httpx.BaseTransport):
    def __init__(self, outcomes, retry_after="0", should_retry="false"):
        self.outcomes = iter(outcomes)
        self.retry_after = retry_after
        self.should_retry = should_retry
        self.requests = []
        self.responses = []
        self.closed = False

    def handle_request(self, request):
        self.requests.append(request)
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        headers = {}
        if outcome >= 400 and self.should_retry is not None:
            headers["Should-Retry"] = self.should_retry
        if outcome >= 400 and self.retry_after is not None:
            headers["Retry-After"] = self.retry_after
        response = httpx.Response(
            outcome,
            headers=headers,
            content=b"response",
            request=request,
        )
        self.responses.append(response)
        return response

    def close(self):
        self.closed = True


class FakeAsyncTransport(httpx.AsyncBaseTransport):
    def __init__(self, outcomes, retry_after="0", should_retry="false"):
        self.outcomes = iter(outcomes)
        self.retry_after = retry_after
        self.should_retry = should_retry
        self.requests = []
        self.responses = []
        self.closed = False

    async def handle_async_request(self, request):
        self.requests.append(request)
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        headers = {}
        if outcome >= 400 and self.should_retry is not None:
            headers["Should-Retry"] = self.should_retry
        if outcome >= 400 and self.retry_after is not None:
            headers["Retry-After"] = self.retry_after
        response = httpx.Response(
            outcome,
            headers=headers,
            content=b"response",
            request=request,
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
    inner = FakeTransport([429, 200], retry_after="2", should_retry="true")
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
    inner = FakeTransport([429, 429, 429], should_retry="true")

    response = RetryableTransport(
        inner, retries=2, sleep=lambda _: None
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response is inner.responses[-1]
    assert len(inner.requests) == 3
    assert all(item.is_closed for item in inner.responses[:-1])
    assert response.content == b"response"


@pytest.mark.parametrize("retry_after", ["soon", "-1", "+1", "1.5"])
def test_invalid_retry_after_falls_back_to_backoff(retry_after):
    inner = FakeTransport([503, 200], retry_after=retry_after, should_retry="true")
    sleeps = []

    response = RetryableTransport(
        inner, retries=3, sleep=sleeps.append, random_=lambda: 0.0
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert sleeps == pytest.approx([0.05])


def test_429_without_header_or_retry_after_uses_backoff():
    inner = FakeTransport([429, 200], retry_after=None, should_retry=None)
    sleeps = []

    response = RetryableTransport(
        inner, retries=3, sleep=sleeps.append, random_=lambda: 0.0
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert sleeps == pytest.approx([0.05])


def test_retry_after_exceeding_timeout_is_propagated_as_is():
    inner = FakeTransport([429], retry_after="4", should_retry="true")
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
    inner = FakeTransport([429], retry_after="60", should_retry="true")
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


@pytest.mark.parametrize("status", [429, 502, 503, 504])
def test_retries_retryable_status_when_header_is_absent(status):
    inner = FakeTransport([status, 200], retry_after="0", should_retry=None)
    sleeps = []

    response = RetryableTransport(
        inner, retries=1, sleep=sleeps.append, monotonic=lambda: 0.0
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert sleeps == [0]


def test_absent_header_429_uses_retry_after():
    inner = FakeTransport([429, 200], retry_after="2", should_retry=None)
    sleeps = []

    response = RetryableTransport(
        inner, retries=1, sleep=sleeps.append, monotonic=lambda: 0.0
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert sleeps == [2]


@pytest.mark.parametrize(
    ("status", "should_retry"),
    [
        (503, "false"),
        (503, "maybe"),
        (503, ""),
        (500, None),
    ],
)
def test_does_not_retry_explicit_denial_or_non_fallback_status(status, should_retry):
    inner = FakeTransport([status], retry_after="0", should_retry=should_retry)

    response = RetryableTransport(inner, retries=3).handle_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1


@pytest.mark.parametrize("status", [502, 503])
def test_retries_unavailable_status_with_exponential_backoff_and_jitter(status):
    inner = FakeTransport(
        [status, status, status, 200], retry_after=None, should_retry="true"
    )
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


def test_retries_post_500_when_marked_by_server():
    inner = FakeTransport([500, 200], retry_after=None, should_retry="true")

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/v2/sandboxes", content=b"p")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_retries_post_503_when_marked_by_server():
    inner = FakeTransport([503, 200], retry_after=None, should_retry="true")

    response = RetryableTransport(
        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/v2/sandboxes", content=b"p")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_retries_post_502_without_should_retry_header():
    inner = FakeTransport([502, 200], retry_after="0", should_retry=None)

    response = RetryableTransport(
        inner, retries=1, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(
        httpx.Request("POST", "https://api.test/v2/sandboxes", content=b"payload")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


@pytest.mark.parametrize("should_retry", ["TRUE", " true "])
def test_should_retry_header_is_case_and_whitespace_insensitive(should_retry):
    inner = FakeTransport([503, 200], should_retry=should_retry)

    response = RetryableTransport(
        inner, retries=1, sleep=lambda _: None, monotonic=lambda: 0.0
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2


def test_backoff_is_capped_for_long_retry_sequences():
    inner = FakeTransport([503] * 9, retry_after=None, should_retry="true")
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
    inner = FakeTransport([503, 200], retry_after="3", should_retry="true")
    sleeps = []

    def random_():
        raise AssertionError("backoff should not be used")

    response = RetryableTransport(
        inner, retries=3, sleep=sleeps.append, random_=random_
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert sleeps == [3]


def test_unavailable_status_exhaustion_returns_final_response():
    inner = FakeTransport([503, 503, 503], retry_after=None, should_retry="true")

    response = RetryableTransport(
        inner, retries=2, sleep=lambda _: None, random_=lambda: 0.0
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response is inner.responses[-1]
    assert len(inner.requests) == 3
    assert response.content == b"response"


def test_backoff_exceeding_timeout_is_propagated_as_is():
    inner = FakeTransport([502], retry_after=None, should_retry="true")
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
    inner = FakeTransport([429, 429], retry_after="2", should_retry="true")
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
    inner = FakeTransport([429], should_retry="true")
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

    inner = AdvancingTransport([429, 200], should_retry="true")
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

    inner = AdvancingTransport([429, 200], should_retry="true")
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

    inner = FakeTransport([429], should_retry="true")
    request = httpx.Request("POST", "https://api.test", content=Stream())

    response = RetryableTransport(inner, retries=3).handle_request(request)

    assert response.status_code == 429
    assert inner.requests == [request]


def test_close_leaves_cached_transport_open():
    inner = FakeTransport([])

    RetryableTransport(inner, retries=1).close()

    assert not inner.closed


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


@pytest.mark.asyncio
async def test_async_retries_rate_limit_and_replays_body():
    inner = FakeAsyncTransport([429, 200], retry_after="2", should_retry="true")
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
async def test_async_429_without_header_or_retry_after_uses_backoff():
    inner = FakeAsyncTransport([429, 200], retry_after=None, should_retry=None)
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner,
        retries=1,
        sleep=sleep,
        monotonic=lambda: 0.0,
        random_=lambda: 0.0,
    ).handle_async_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert sleeps == pytest.approx([0.05])


@pytest.mark.asyncio
async def test_async_absent_header_429_uses_retry_after():
    inner = FakeAsyncTransport([429, 200], retry_after="2", should_retry=None)
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner, retries=1, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert sleeps == [2]


@pytest.mark.asyncio
async def test_async_does_not_retry_when_wait_reaches_request_timeout():
    inner = FakeAsyncTransport([429], retry_after="3", should_retry="true")
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
    inner = FakeAsyncTransport([429], should_retry="true")
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
    inner = FakeAsyncTransport(
        [503, 502, 504, 200], retry_after=None, should_retry=None
    )
    sleeps = []
    randoms = iter([0.0, 1.0, 0.5])

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
    assert sleeps == pytest.approx([0.05, 0.2, 0.3])
    assert [item.content for item in inner.requests] == [b"payload"] * 4
    assert all(item.is_closed for item in inner.responses[:-1])


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [500, 503])
async def test_async_retries_post_when_marked_by_server(status):
    inner = FakeAsyncTransport([status, 200], retry_after=None, should_retry="true")

    async def sleep(_):
        pass

    response = await AsyncRetryableTransport(
        inner, retries=1, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/v2/sandboxes", content=b"payload")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


@pytest.mark.asyncio
async def test_async_retries_post_502_without_should_retry_header():
    inner = FakeAsyncTransport([502, 200], retry_after="0", should_retry=None)

    async def sleep(_):
        pass

    response = await AsyncRetryableTransport(
        inner, retries=1, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(
        httpx.Request("POST", "https://api.test/v2/sandboxes", content=b"payload")
    )

    assert response.status_code == 200
    assert len(inner.requests) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("should_retry", ["TRUE", " true "])
async def test_async_should_retry_header_is_case_and_whitespace_insensitive(
    should_retry,
):
    inner = FakeAsyncTransport([503, 200], should_retry=should_retry)

    async def sleep(_):
        pass

    response = await AsyncRetryableTransport(
        inner, retries=1, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [429, 502, 503, 504])
async def test_async_retries_retryable_status_when_header_is_absent(status):
    inner = FakeAsyncTransport([status, 200], retry_after="0", should_retry=None)
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRetryableTransport(
        inner, retries=1, sleep=sleep, monotonic=lambda: 0.0
    ).handle_async_request(httpx.Request("GET", "https://api.test"))

    assert response.status_code == 200
    assert len(inner.requests) == 2
    assert sleeps == [0]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "should_retry"),
    [
        (503, "false"),
        (503, "maybe"),
        (503, ""),
        (500, None),
    ],
)
async def test_async_does_not_retry_explicit_denial_or_non_fallback_status(
    status, should_retry
):
    inner = FakeAsyncTransport([status], retry_after="0", should_retry=should_retry)

    response = await AsyncRetryableTransport(inner, retries=3).handle_async_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response is inner.responses[0]
    assert len(inner.requests) == 1


@pytest.mark.asyncio
async def test_async_retry_after_exceeding_timeout_is_propagated_as_is():
    inner = FakeAsyncTransport([429], retry_after="4", should_retry="true")
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
    inner = FakeAsyncTransport([429], retry_after="60", should_retry="true")
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

    inner = AdvancingTransport([429, 200], should_retry="true")

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

    inner = AdvancingTransport([429, 200], should_retry="true")

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

    inner = FakeAsyncTransport([429], should_retry="true")
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


@pytest.mark.parametrize(
    "error",
    [httpx.ReadError("connection reset"), httpx.RemoteProtocolError("stream reset")],
)
def test_does_not_retry_post_write_network_errors(error):
    inner = FakeTransport([error, 200])

    with pytest.raises(type(error)):
        RetryableTransport(inner, retries=3, sleep=lambda _: None).handle_request(
            httpx.Request("POST", "https://api.test/v2/sandboxes", content=b"payload")
        )

    assert len(inner.requests) == 1


@pytest.mark.asyncio
async def test_async_exhaustion_returns_final_retryable_response():
    inner = FakeAsyncTransport([503, 503, 503], should_retry="true")

    async def sleep(_):
        pass

    response = await AsyncRetryableTransport(
        inner, retries=2, sleep=sleep
    ).handle_async_request(httpx.Request("GET", "https://api.test"))

    assert response is inner.responses[-1]
    assert len(inner.requests) == 3
    assert response.content == b"response"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error",
    [httpx.ReadError("connection reset"), httpx.RemoteProtocolError("stream reset")],
)
async def test_async_does_not_retry_post_write_network_errors(error):
    inner = FakeAsyncTransport([error, 200])

    async def sleep(_):
        pass

    with pytest.raises(type(error)):
        await AsyncRetryableTransport(
            inner, retries=3, sleep=sleep
        ).handle_async_request(
            httpx.Request("POST", "https://api.test/v2/sandboxes", content=b"payload")
        )

    assert len(inner.requests) == 1


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
