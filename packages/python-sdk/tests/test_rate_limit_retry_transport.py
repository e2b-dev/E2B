import httpx
import pytest

from e2b.retry import AsyncRateLimitTransport, RateLimitTransport, parse_retry_after


class FakeTransport(httpx.BaseTransport):
    def __init__(self, statuses, retry_after="0"):
        self.statuses = iter(statuses)
        self.retry_after = retry_after
        self.requests = []
        self.responses = []
        self.closed = False

    def handle_request(self, request):
        self.requests.append(request)
        response = httpx.Response(
            next(self.statuses),
            headers={"Retry-After": self.retry_after} if self.retry_after else {},
            content=b"response",
            request=request,
        )
        self.responses.append(response)
        return response

    def close(self):
        self.closed = True


class FakeAsyncTransport(httpx.AsyncBaseTransport):
    def __init__(self, statuses, retry_after="0"):
        self.statuses = iter(statuses)
        self.retry_after = retry_after
        self.requests = []
        self.responses = []
        self.closed = False

    async def handle_async_request(self, request):
        self.requests.append(request)
        response = httpx.Response(
            next(self.statuses),
            headers={"Retry-After": self.retry_after} if self.retry_after else {},
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
    inner = FakeTransport([429, 200], retry_after="2")
    sleeps = []
    request = httpx.Request("POST", "https://api.test", content=b"payload")

    response = RateLimitTransport(inner, retries=3, sleep=sleeps.append).handle_request(
        request
    )

    assert response.status_code == 200
    assert sleeps == [2]
    assert [item.content for item in inner.requests] == [b"payload", b"payload"]
    assert inner.responses[0].is_closed


def test_exhaustion_returns_final_rate_limit_response():
    inner = FakeTransport([429, 429, 429])

    response = RateLimitTransport(
        inner, retries=2, sleep=lambda _: None
    ).handle_request(httpx.Request("GET", "https://api.test"))

    assert response is inner.responses[-1]
    assert len(inner.requests) == 3
    assert all(item.is_closed for item in inner.responses[:-1])
    assert response.content == b"response"


@pytest.mark.parametrize("retry_after", ["soon", "-1", "+1", "1.5"])
def test_does_not_retry_without_delta_seconds(retry_after):
    inner = FakeTransport([429], retry_after=retry_after)

    response = RateLimitTransport(inner, retries=3).handle_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response.status_code == 429
    assert len(inner.requests) == 1


def test_429_without_retry_after_is_propagated_as_is():
    inner = FakeTransport([429], retry_after=None)

    response = RateLimitTransport(inner, retries=3).handle_request(
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

    response = RateLimitTransport(
        inner, retries=3, sleep=sleeps.append, monotonic=lambda: 0.0
    ).handle_request(request)

    assert response is inner.responses[0]
    assert len(inner.requests) == 1
    assert sleeps == []


def test_does_not_retry_other_status_codes():
    inner = FakeTransport([503], retry_after="0")

    response = RateLimitTransport(inner, retries=3).handle_request(
        httpx.Request("GET", "https://api.test")
    )

    assert response.status_code == 503
    assert len(inner.requests) == 1


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

    response = RateLimitTransport(
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
        RateLimitTransport(
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

    response = RateLimitTransport(
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

    RateLimitTransport(
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

    response = RateLimitTransport(inner, retries=0).handle_request(request)

    assert response.status_code == 429
    assert inner.requests == [request]


def test_does_not_buffer_or_retry_streamed_body():
    class Stream(httpx.SyncByteStream):
        def __iter__(self):
            yield b"payload"

    inner = FakeTransport([429])
    request = httpx.Request("POST", "https://api.test", content=Stream())

    response = RateLimitTransport(inner, retries=3).handle_request(request)

    assert response.status_code == 429
    assert inner.requests == [request]


def test_close_leaves_cached_transport_open():
    inner = FakeTransport([])

    RateLimitTransport(inner, retries=1).close()

    assert not inner.closed


@pytest.mark.asyncio
async def test_async_retries_rate_limit_and_replays_body():
    inner = FakeAsyncTransport([429, 200], retry_after="2")
    sleeps = []

    async def sleep(delay):
        sleeps.append(delay)

    response = await AsyncRateLimitTransport(
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

    response = await AsyncRateLimitTransport(
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
        await AsyncRateLimitTransport(
            inner,
            retries=1,
            sleep=sleep,
            monotonic=clock.monotonic,
        ).handle_async_request(request)


@pytest.mark.asyncio
async def test_async_429_without_retry_after_is_propagated_as_is():
    inner = FakeAsyncTransport([429], retry_after=None)

    response = await AsyncRateLimitTransport(inner, retries=3).handle_async_request(
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

    response = await AsyncRateLimitTransport(
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

    response = await AsyncRateLimitTransport(
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

    await AsyncRateLimitTransport(
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

    response = await AsyncRateLimitTransport(inner, retries=3).handle_async_request(
        request
    )

    assert response.status_code == 429
    assert inner.requests == [request]


@pytest.mark.asyncio
async def test_async_close_leaves_cached_transport_open():
    inner = FakeAsyncTransport([])

    await AsyncRateLimitTransport(inner, retries=1).aclose()

    assert not inner.closed


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
