import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import httpx

import pytest

from e2b import (
    AsyncSandbox,
    TimeoutException,
    Sandbox,
    SandboxPauseResult,
    SandboxException,
    SandboxNotFoundException,
    SandboxPauseRefusedException,
    ServiceBusyException,
)
import e2b.sandbox_async.sandbox_api as async_sandbox_api
import e2b.sandbox_sync.sandbox_api as sync_sandbox_api
from e2b.api import ApiClient, AsyncApiClient
from e2b.retry import AsyncRetryableTransport, RetryableTransport
from e2b.api.client.api.sandboxes import post_sandboxes_sandbox_id_pause
from e2b.api.client.models import Error
from e2b.api.client.models import SandboxPauseResult as SandboxPauseResultAPI

REFUSED_MESSAGE = (
    "Sandbox 'sbx-test' cannot be paused right now because the sandbox guest "
    "agent is not responding: retry, or pause with force to take the snapshot "
    "without the health check"
)
BUSY_MESSAGE = (
    "Sandbox 'sbx-test' cannot be paused right now because its node is busy, "
    "please retry"
)
DRAINING_MESSAGE = (
    "Sandbox 'sbx-test' cannot be paused right now because the server is "
    "shutting down, please retry"
)


def _response(status_code: int, body: dict):
    """A pause response the way the generated client builds it: the raw body
    and, for an error status, the parsed ``Error`` model."""
    parsed = (
        SandboxPauseResultAPI.from_dict(body)
        if status_code == 200
        else Error.from_dict(body)
    )
    return SimpleNamespace(
        status_code=status_code,
        content=json.dumps(body).encode(),
        parsed=parsed,
        headers={},
    )


def _answer(monkeypatch, response):
    request = Mock(return_value=response)
    monkeypatch.setattr(post_sandboxes_sandbox_id_pause, "sync_detailed", request)
    return request


def _answer_async(monkeypatch, response):
    request = AsyncMock(return_value=response)
    monkeypatch.setattr(post_sandboxes_sandbox_id_pause, "asyncio_detailed", request)
    return request


def test_pause_returns_paused_not_forced(monkeypatch, test_api_key):
    _answer(monkeypatch, _response(200, {"forced": False}))

    assert Sandbox.pause("sbx-test", api_key=test_api_key) == SandboxPauseResult(
        paused=True, forced=False
    )


def test_forced_pause_returns_paused_and_forced(monkeypatch, test_api_key):
    request = _answer(monkeypatch, _response(200, {"forced": True}))

    assert Sandbox.pause(
        "sbx-test", force=True, api_key=test_api_key
    ) == SandboxPauseResult(paused=True, forced=True)
    assert request.call_args.kwargs["body"].to_dict()["force"] is True


def test_forced_reports_what_the_api_did_not_the_option(monkeypatch, test_api_key):
    # A forced request that joined a normal pause already in flight is not forced.
    _answer(monkeypatch, _response(200, {"forced": False}))

    assert Sandbox.pause(
        "sbx-test", force=True, api_key=test_api_key
    ) == SandboxPauseResult(paused=True, forced=False)


def test_pause_on_an_older_api_answering_204_is_paused_not_forced(
    monkeypatch, test_api_key
):
    _answer(monkeypatch, SimpleNamespace(status_code=204, parsed=None, content=b""))

    assert Sandbox.pause("sbx-test", api_key=test_api_key) == SandboxPauseResult(
        paused=True, forced=False
    )


def test_pause_of_an_already_paused_sandbox_is_not_paused(monkeypatch, test_api_key):
    _answer(
        monkeypatch,
        _response(409, {"code": 409, "message": "Sandbox is already paused"}),
    )

    assert Sandbox.pause("sbx-test", api_key=test_api_key) == SandboxPauseResult(
        paused=False, forced=False
    )


def test_refused_pause_raises_the_typed_exception(monkeypatch, test_api_key):
    _answer(
        monkeypatch,
        _response(
            503,
            {
                "code": 503,
                "error_code": "sandbox_pause_refused",
                "message": REFUSED_MESSAGE,
            },
        ),
    )

    with pytest.raises(SandboxPauseRefusedException) as excinfo:
        Sandbox.pause("sbx-test", api_key=test_api_key)

    err = excinfo.value
    # Subclass of the generic 503 exception, so handlers written for it keep working.
    assert isinstance(err, ServiceBusyException)
    assert err.status_code == 503
    assert err.error_code == "sandbox_pause_refused"
    # The API's message verbatim: it names the reason and what to do.
    assert str(err) == REFUSED_MESSAGE


def test_refusal_for_a_busy_node_carries_the_same_code_and_the_reason(
    monkeypatch, test_api_key
):
    _answer(
        monkeypatch,
        _response(
            503,
            {
                "code": 503,
                "error_code": "sandbox_pause_refused",
                "message": BUSY_MESSAGE,
            },
        ),
    )

    with pytest.raises(SandboxPauseRefusedException) as excinfo:
        Sandbox.pause("sbx-test", api_key=test_api_key)

    assert str(excinfo.value) == BUSY_MESSAGE


def test_503_with_no_error_code_at_all_stays_a_busy_exception(
    monkeypatch, test_api_key
):
    _answer(monkeypatch, _response(503, {"code": 503, "message": DRAINING_MESSAGE}))

    with pytest.raises(ServiceBusyException) as excinfo:
        Sandbox.pause("sbx-test", api_key=test_api_key)

    assert not isinstance(excinfo.value, SandboxPauseRefusedException)
    assert "server is shutting down" in str(excinfo.value)


def test_force_on_a_filesystem_only_pause_is_a_400(monkeypatch, test_api_key):
    _answer(
        monkeypatch,
        _response(400, {"code": 400, "message": "force applies to memory pauses only"}),
    )

    with pytest.raises(SandboxException) as excinfo:
        Sandbox.pause("sbx-test", mode="filesystem", force=True, api_key=test_api_key)

    assert excinfo.value.status_code == 400
    assert "force applies to memory pauses only" in str(excinfo.value)


def test_pause_of_a_missing_sandbox_raises_not_found(monkeypatch, test_api_key):
    _answer(monkeypatch, _response(404, {"code": 404, "message": "Sandbox not found"}))

    with pytest.raises(SandboxNotFoundException):
        Sandbox.pause("sbx-test", api_key=test_api_key)


async def test_async_pause_returns_paused_not_forced(monkeypatch, test_api_key):
    _answer_async(monkeypatch, _response(200, {"forced": False}))

    assert await AsyncSandbox.pause(
        "sbx-test", api_key=test_api_key
    ) == SandboxPauseResult(paused=True, forced=False)


async def test_async_forced_pause_returns_paused_and_forced(monkeypatch, test_api_key):
    request = _answer_async(monkeypatch, _response(200, {"forced": True}))

    assert await AsyncSandbox.pause(
        "sbx-test", force=True, api_key=test_api_key
    ) == SandboxPauseResult(paused=True, forced=True)
    assert request.call_args.kwargs["body"].to_dict()["force"] is True


async def test_async_pause_on_an_older_api_answering_204_is_paused_not_forced(
    monkeypatch, test_api_key
):
    _answer_async(
        monkeypatch, SimpleNamespace(status_code=204, parsed=None, content=b"")
    )

    assert await AsyncSandbox.pause(
        "sbx-test", api_key=test_api_key
    ) == SandboxPauseResult(paused=True, forced=False)


async def test_async_pause_of_an_already_paused_sandbox_is_not_paused(
    monkeypatch, test_api_key
):
    _answer_async(
        monkeypatch,
        _response(409, {"code": 409, "message": "Sandbox is already paused"}),
    )

    assert await AsyncSandbox.pause(
        "sbx-test", api_key=test_api_key
    ) == SandboxPauseResult(paused=False, forced=False)


async def test_async_refused_pause_raises_the_typed_exception(
    monkeypatch, test_api_key
):
    _answer_async(
        monkeypatch,
        _response(
            503,
            {
                "code": 503,
                "error_code": "sandbox_pause_refused",
                "message": REFUSED_MESSAGE,
            },
        ),
    )

    with pytest.raises(SandboxPauseRefusedException) as excinfo:
        await AsyncSandbox.pause("sbx-test", api_key=test_api_key)

    assert isinstance(excinfo.value, ServiceBusyException)
    assert excinfo.value.status_code == 503
    assert str(excinfo.value) == REFUSED_MESSAGE


async def test_async_503_with_no_error_code_at_all_stays_a_busy_exception(
    monkeypatch, test_api_key
):
    _answer_async(
        monkeypatch, _response(503, {"code": 503, "message": DRAINING_MESSAGE})
    )

    with pytest.raises(ServiceBusyException) as excinfo:
        await AsyncSandbox.pause("sbx-test", api_key=test_api_key)

    assert not isinstance(excinfo.value, SandboxPauseRefusedException)


async def test_async_force_on_a_filesystem_only_pause_is_a_400(
    monkeypatch, test_api_key
):
    _answer_async(
        monkeypatch,
        _response(400, {"code": 400, "message": "force applies to memory pauses only"}),
    )

    with pytest.raises(SandboxException) as excinfo:
        await AsyncSandbox.pause(
            "sbx-test", mode="filesystem", force=True, api_key=test_api_key
        )

    assert excinfo.value.status_code == 400


# The tests above mock the generated client's `sync_detailed`; these go through
# its real response parsing over an httpx mock transport, so the 200 body is
# parsed into the generated model and the 204 path sees `parsed is None`.


def _mock_api(monkeypatch, answer, clock=None):
    """Route both clients through the SDK's own retry transports over an
    httpx mock transport whose responses, like pyqwest's, carry no request
    (httpx attaches it after the transport returns). ``answer`` builds a fresh
    response per request; ``clock`` replaces the transports' monotonic clock
    and sleep."""
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return answer()

    def sync_client(config):
        inner = httpx.MockTransport(handler)
        if clock is None:
            transport = RetryableTransport(inner, config.retries)
        else:
            transport = RetryableTransport(
                inner, config.retries, sleep=clock.sleep, monotonic=clock.monotonic
            )
        return ApiClient(config, transport=transport)

    def async_client(config):
        inner = httpx.MockTransport(handler)
        if clock is None:
            transport = AsyncRetryableTransport(inner, config.retries)
        else:
            fake = clock

            async def async_sleep(delay: float) -> None:
                fake.sleep(delay)

            transport = AsyncRetryableTransport(
                inner, config.retries, sleep=async_sleep, monotonic=fake.monotonic
            )
        return AsyncApiClient(config, transport=transport)

    monkeypatch.setattr(sync_sandbox_api, "get_api_client", sync_client)
    monkeypatch.setattr(async_sandbox_api, "get_api_client", async_client)
    return seen


@pytest.mark.parametrize("forced", [True, False])
def test_pause_parses_the_200_body(monkeypatch, test_api_key, forced):
    seen = _mock_api(monkeypatch, lambda: httpx.Response(200, json={"forced": forced}))

    result = Sandbox.pause("sbx-test", force=forced, api_key=test_api_key)

    assert result == SandboxPauseResult(paused=True, forced=forced)
    assert json.loads(seen[0].content) == {"force": forced}


def test_pause_accepts_a_204_from_an_older_api(monkeypatch, test_api_key):
    seen = _mock_api(monkeypatch, lambda: httpx.Response(204))

    result = Sandbox.pause("sbx-test", api_key=test_api_key)

    assert result == SandboxPauseResult(paused=True, forced=False)
    assert json.loads(seen[0].content) == {}


@pytest.mark.parametrize("forced", [True, False])
async def test_async_pause_parses_the_200_body(monkeypatch, test_api_key, forced):
    seen = _mock_api(monkeypatch, lambda: httpx.Response(200, json={"forced": forced}))

    result = await AsyncSandbox.pause("sbx-test", force=forced, api_key=test_api_key)

    assert result == SandboxPauseResult(paused=True, forced=forced)
    assert json.loads(seen[0].content) == {"force": forced}


async def test_async_pause_accepts_a_204_from_an_older_api(monkeypatch, test_api_key):
    _mock_api(monkeypatch, lambda: httpx.Response(204))

    result = await AsyncSandbox.pause("sbx-test", api_key=test_api_key)

    assert result == SandboxPauseResult(paused=True, forced=False)


def test_pause_refusal_through_the_real_parsing(monkeypatch, test_api_key):
    _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503,
            json={
                "code": 503,
                "error_code": "sandbox_pause_refused",
                "message": REFUSED_MESSAGE,
            },
        ),
    )

    with pytest.raises(SandboxPauseRefusedException) as excinfo:
        Sandbox.pause("sbx-test", api_key=test_api_key)

    assert str(excinfo.value) == REFUSED_MESSAGE


async def test_async_pause_refusal_through_the_real_parsing(monkeypatch, test_api_key):
    _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503,
            json={
                "code": 503,
                "error_code": "sandbox_pause_refused",
                "message": REFUSED_MESSAGE,
            },
        ),
    )

    with pytest.raises(SandboxPauseRefusedException) as excinfo:
        await AsyncSandbox.pause("sbx-test", api_key=test_api_key)

    assert str(excinfo.value) == REFUSED_MESSAGE


class _Clock:
    def __init__(self):
        self.now = 0.0
        self.sleeps = []

    def monotonic(self):
        return self.now

    def sleep(self, delay):
        self.sleeps.append(delay)
        self.now += delay


class _StalledBody(httpx.SyncByteStream):
    """A 503 body whose read eats 2 s of the clock and then times out."""

    def __init__(self, clock):
        self.clock = clock

    def __iter__(self):
        self.clock.now += 2.0
        raise httpx.ReadTimeout("stalled")
        yield b""  # pragma: no cover


def test_pause_whose_refusal_body_read_times_out_with_no_budget_left_reports_the_timeout(
    monkeypatch, test_api_key
):
    clock = _Clock()
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503,
            stream=_StalledBody(clock),
            headers={"Content-Type": "application/json", "Content-Length": "40"},
        ),
        clock=clock,
    )

    # A 1 s request timeout is the whole retry budget; the read outlives it.
    with pytest.raises(Exception) as excinfo:
        Sandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert not isinstance(excinfo.value, SandboxPauseRefusedException)
    assert isinstance(excinfo.value, (httpx.TimeoutException, TimeoutException))
    assert len(seen) == 1


REFUSAL_CHUNKS = (
    b'{"code":503,"error_code":"sand',
    b"box_pause_",
    b'refused","message":"refused"}',
)


class _DripBody(httpx.SyncByteStream):
    """A 503 body whose every chunk eats 0.6 s of the clock; ``tail`` chunks
    follow the complete refusal and must never be pulled. Counts closes."""

    def __init__(self, clock, chunks=REFUSAL_CHUNKS, tail=()):
        self.clock = clock
        self.chunks = chunks
        self.tail = tail
        self.closes = 0
        self.pulled = 0

    def __iter__(self):
        for chunk in self.chunks:
            self.clock.now += 0.6
            self.pulled += 1
            yield chunk
        for chunk in self.tail:
            self.pulled += 1
            yield chunk

    def close(self):
        self.closes += 1


class _AsyncDripBody(httpx.AsyncByteStream):
    def __init__(self, clock, chunks=REFUSAL_CHUNKS, tail=()):
        self.clock = clock
        self.chunks = chunks
        self.tail = tail
        self.closes = 0
        self.pulled = 0

    async def __aiter__(self):
        for chunk in self.chunks:
            self.clock.now += 0.6
            self.pulled += 1
            yield chunk
        for chunk in self.tail:
            self.pulled += 1
            yield chunk

    async def aclose(self):
        self.closes += 1


def test_pause_whose_refusal_body_trickles_past_the_budget_still_surfaces_the_refusal(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _DripBody(clock, tail=(b"\n",))
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503, stream=body, headers={"Content-Type": "application/json"}
        ),
        clock=clock,
    )

    # Three chunks at 0.6 s against the 1 s request timeout: the peek is cut
    # off on the third chunk, which completes the refusal, so the buffered
    # bytes are used as the body and the live tail is never read.
    with pytest.raises(SandboxPauseRefusedException):
        Sandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert len(seen) == 1
    assert body.pulled == 3
    assert body.closes == 1


class _BigRefusalBody(httpx.SyncByteStream):
    """A refusal body past the 8 KiB cap, in three chunks of 0.5 s each, so
    only the cap stops the peek. Counts closes and pulls."""

    BODY = (
        b'{"code":503,"error_code":"sandbox_pause_refused","message":"'
        + b"x" * 9000
        + b'"}'
    )

    def __init__(self, clock):
        self.clock = clock
        self.closes = 0
        self.pulled = 0

    def __iter__(self):
        for chunk in (self.BODY[:4200], self.BODY[4200:8400], self.BODY[8400:]):
            self.clock.now += 0.5
            self.pulled += 1
            yield chunk

    def close(self):
        self.closes += 1


class _AsyncBigRefusalBody(httpx.AsyncByteStream):
    def __init__(self, clock):
        self.clock = clock
        self.closes = 0
        self.pulled = 0

    async def __aiter__(self):
        body = _BigRefusalBody.BODY
        for chunk in (body[:4200], body[4200:8400], body[8400:]):
            self.clock.now += 0.5
            self.pulled += 1
            yield chunk

    async def aclose(self):
        self.closes += 1


def test_pause_whose_refusal_body_passes_the_cap_with_no_budget_left_times_out_at_the_deadline(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _BigRefusalBody(clock)
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503,
            stream=body,
            headers={
                "Content-Type": "application/json",
                "Transfer-Encoding": "chunked",
            },
        ),
        clock=clock,
    )

    # Over the cap on the second chunk at the 1 s request timeout: the 503 is
    # handed on, but its third chunk would be waited for past the deadline,
    # so the read ends there with a timeout instead of running on; the inner
    # response is closed once.
    with pytest.raises(httpx.ReadTimeout):
        Sandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert len(seen) == 1
    assert body.pulled == 2
    assert body.closes == 1


# The refusal split so that the third chunk leaves the JSON open: the peek cut
# off there holds no refusal yet, and the body is handed on with a live tail.
OPEN_REFUSAL_CHUNKS = (
    b'{"code":503,"error_code":"sand',
    b"box_pause_",
    b'refused","message":"refused"',
)


def test_pause_whose_handed_on_body_trickles_past_the_deadline_times_out_at_the_deadline(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _DripBody(clock, chunks=OPEN_REFUSAL_CHUNKS, tail=(b"}",))
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503, stream=body, headers={"Content-Type": "application/json"}
        ),
        clock=clock,
    )

    # Cut off on the third chunk with the JSON still open and no budget left:
    # the 503 is handed on, but its tail would be read past the 1 s request
    # timeout, so the read ends there with a timeout instead of running on.
    with pytest.raises(httpx.ReadTimeout):
        Sandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert len(seen) == 1
    assert body.pulled == 3
    assert body.closes == 1


async def test_async_pause_whose_handed_on_body_trickles_past_the_deadline_times_out_at_the_deadline(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _AsyncDripBody(clock, chunks=OPEN_REFUSAL_CHUNKS, tail=(b"}",))
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503, stream=body, headers={"Content-Type": "application/json"}
        ),
        clock=clock,
    )

    with pytest.raises(httpx.ReadTimeout):
        await AsyncSandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert len(seen) == 1
    assert body.pulled == 3
    assert body.closes == 1


async def test_async_pause_whose_refusal_body_passes_the_cap_with_no_budget_left_times_out_at_the_deadline(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _AsyncBigRefusalBody(clock)
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503,
            stream=body,
            headers={
                "Content-Type": "application/json",
                "Transfer-Encoding": "chunked",
            },
        ),
        clock=clock,
    )

    with pytest.raises(httpx.ReadTimeout):
        await AsyncSandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert len(seen) == 1
    assert body.pulled == 2
    assert body.closes == 1


async def test_async_pause_whose_refusal_body_trickles_past_the_budget_still_surfaces_the_refusal(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _AsyncDripBody(clock, tail=(b"\n",))
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503, stream=body, headers={"Content-Type": "application/json"}
        ),
        clock=clock,
    )

    with pytest.raises(SandboxPauseRefusedException):
        await AsyncSandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert len(seen) == 1
    assert body.pulled == 3
    assert body.closes == 1


# A busy 503 (no refusal code) whose complete body lands in the very chunk that
# stops the peek: it must surface as the API error it is, not as a timeout.
BUSY_CHUNKS = (b'{"code":503,"message":"node is bu', b"sy persisting ", b'sandbox"}')


def test_pause_whose_busy_body_completes_in_the_cut_off_chunk_surfaces_the_busy_error(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _DripBody(clock, chunks=BUSY_CHUNKS, tail=(b"\n",))
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503, stream=body, headers={"Content-Type": "application/json"}
        ),
        clock=clock,
    )

    with pytest.raises(ServiceBusyException) as excinfo:
        Sandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert not isinstance(excinfo.value, SandboxPauseRefusedException)
    assert "node is busy persisting sandbox" in str(excinfo.value)
    assert len(seen) == 1
    assert body.pulled == 3
    assert body.closes == 1


async def test_async_pause_whose_busy_body_completes_in_the_cut_off_chunk_surfaces_the_busy_error(
    monkeypatch, test_api_key
):
    clock = _Clock()
    body = _AsyncDripBody(clock, chunks=BUSY_CHUNKS, tail=(b"\n",))
    seen = _mock_api(
        monkeypatch,
        lambda: httpx.Response(
            503, stream=body, headers={"Content-Type": "application/json"}
        ),
        clock=clock,
    )

    with pytest.raises(ServiceBusyException) as excinfo:
        await AsyncSandbox.pause("sbx-test", api_key=test_api_key, request_timeout=1)

    assert not isinstance(excinfo.value, SandboxPauseRefusedException)
    assert "node is busy persisting sandbox" in str(excinfo.value)
    assert len(seen) == 1
    assert body.pulled == 3
    assert body.closes == 1
