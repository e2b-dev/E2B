from typing import List, Optional

import httpx
import pytest
from pyqwest import Headers, Request, Response, SyncRequest, SyncResponse

from e2b import ConnectionConfig
from e2b.plane_routing import (
    ALT_USED_HEADER,
    PLANE_TTL,
    AsyncEnvdPlaneRoutingRpcTransport,
    AsyncPlaneRoutingTransport,
    EnvdPlaneRouting,
    EnvdPlaneRoutingRpcTransport,
    EnvdPlaneRoutingTransport,
    PlaneRoutingTransport,
    current_plane,
    learn_plane,
    move_host,
    plane_key,
    reset_planes,
)

API_KEY = "e2b_test"
KEY = "e2b.app\ne2b_test"


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    reset_planes()
    for name in ("E2B_API_URL", "E2B_SANDBOX_URL", "E2B_DEBUG", "E2B_DOMAIN"):
        monkeypatch.delenv(name, raising=False)
    yield
    reset_planes()


def config(
    domain: str = "e2b.app",
    debug: Optional[bool] = None,
    api_url: Optional[str] = None,
    sandbox_url: Optional[str] = None,
) -> ConnectionConfig:
    return ConnectionConfig(
        api_key=API_KEY,
        domain=domain,
        debug=debug,
        api_url=api_url,
        sandbox_url=sandbox_url,
    )


def connection_refused(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("connection refused", request=request)


class Replies:
    """An httpx handler answering with ``replies`` in order, recording URLs."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.urls: List[str] = []
        self.bodies: List[bytes] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.urls.append(str(request.url))
        self.bodies.append(request.read())
        reply = self.replies.pop(0)
        if callable(reply):
            return reply(request)
        status, alt_used = reply
        headers = {ALT_USED_HEADER: alt_used} if alt_used else {}
        return httpx.Response(status, headers=headers, request=request)


class TestPlaneKey:
    def test_routes_a_supported_domain_with_an_api_key(self):
        assert plane_key(config()) == KEY
        assert plane_key(config(domain="e2b.dev")) is not None

    @pytest.mark.parametrize(
        "opts",
        [
            {"debug": True},
            {"domain": "example.com"},
            {"api_url": "https://api.example.com"},
            {"sandbox_url": "https://sbx.local"},
        ],
    )
    def test_does_not_route(self, opts):
        assert plane_key(config(**opts)) is None

    def test_does_not_route_without_an_api_key(self, monkeypatch):
        monkeypatch.delenv("E2B_API_KEY", raising=False)
        assert plane_key(ConnectionConfig(domain="e2b.app")) is None


class TestLearnPlane:
    def test_learns_a_supported_plane_from_a_supported_api_host(self):
        learn_plane(KEY, "https://api.e2b.app/sandboxes", "api.e2b-foxtrot.dev")
        assert current_plane(KEY) == "e2b-foxtrot.dev"

    def test_follows_a_later_response_that_names_another_plane(self):
        learn_plane(KEY, "https://api.e2b.app/a", "api.e2b-foxtrot.dev")
        learn_plane(KEY, "https://api.e2b.app/b", "api.foxtrot-3.e2b.dev")
        assert current_plane(KEY) == "foxtrot-3.e2b.dev"

    @pytest.mark.parametrize(
        "url",
        [
            "https://api.example.com/sandboxes",
            "https://sandbox.e2b.app/files",
            "https://49983-sbx.e2b.app/files",
        ],
    )
    def test_ignores_a_response_from(self, url):
        learn_plane(KEY, url, "api.e2b-foxtrot.dev")
        assert current_plane(KEY) is None

    @pytest.mark.parametrize(
        "hint",
        [
            "api.example.com",
            "api.ctp-staging-1-us-west-2-aws.e2b.dev",
            "e2b-foxtrot.dev",
            "sandbox.e2b-foxtrot.dev",
            "api.e2b-foxtrot.dev:8443",
            "https://api.e2b-foxtrot.dev",
            "",
            None,
        ],
    )
    def test_ignores_the_hint(self, hint):
        learn_plane(KEY, "https://api.e2b.app/sandboxes", hint)
        assert current_plane(KEY) is None

    def test_expires_a_plane_after_the_ttl(self):
        learn_plane(KEY, "https://api.e2b.app/a", "api.e2b-foxtrot.dev", now=0)
        assert current_plane(KEY, now=PLANE_TTL - 1) == "e2b-foxtrot.dev"
        assert current_plane(KEY, now=PLANE_TTL) is None


@pytest.mark.parametrize(
    "url, moved",
    [
        ("https://api.e2b.app/sandboxes", "https://api.e2b-foxtrot.dev/sandboxes"),
        (
            "https://sandbox.e2b.app/files?p=1",
            "https://sandbox.e2b-foxtrot.dev/files?p=1",
        ),
        ("https://49983-sbx.e2b.app/x", "https://49983-sbx.e2b-foxtrot.dev/x"),
        ("https://sandbox.example.com/x", None),
        ("https://e2b.app/x", None),
        ("https://a.b.e2b.app/x", None),
    ],
)
def test_move_host(url, moved):
    assert move_host(url, "e2b.app", "e2b-foxtrot.dev") == moved


class TestApiRouting:
    def client(self, replies: Replies, **opts) -> httpx.Client:
        return httpx.Client(
            transport=PlaneRoutingTransport(
                httpx.MockTransport(replies), config(**opts)
            )
        )

    def test_sends_later_requests_to_the_plane_the_proxy_named(self):
        replies = Replies((200, "api.e2b-foxtrot.dev"), (200, None))
        with self.client(replies) as client:
            client.get("https://api.e2b.app/sandboxes")
            client.post("https://api.e2b.app/sandboxes", content=b'{"a":1}')

        assert replies.urls == [
            "https://api.e2b.app/sandboxes",
            "https://api.e2b-foxtrot.dev/sandboxes",
        ]
        assert replies.bodies[1] == b'{"a":1}'

    @pytest.mark.parametrize("plane_answer", [(401, None), connection_refused])
    def test_sends_the_request_through_the_proxy_again(self, plane_answer):
        replies = Replies(
            (200, "api.e2b-foxtrot.dev"),
            plane_answer,
            (200, "api.foxtrot-2.e2b.dev"),
        )
        with self.client(replies) as client:
            client.get("https://api.e2b.app/sandboxes")
            response = client.post("https://api.e2b.app/sandboxes", content=b"{}")

        assert response.status_code == 200
        assert replies.urls == [
            "https://api.e2b.app/sandboxes",
            "https://api.e2b-foxtrot.dev/sandboxes",
            "https://api.e2b.app/sandboxes",
        ]
        assert replies.bodies[2] == b"{}"
        assert current_plane(KEY) == "foxtrot-2.e2b.dev"

    def test_does_not_send_again_after_a_read_error(self):
        def read_error(request):
            raise httpx.ReadError("reset", request=request)

        replies = Replies((200, "api.e2b-foxtrot.dev"), read_error)
        with self.client(replies) as client:
            client.get("https://api.e2b.app/sandboxes")
            with pytest.raises(httpx.ReadError):
                client.post("https://api.e2b.app/sandboxes", content=b"{}")

        assert len(replies.urls) == 2

    def test_does_not_route_an_unrouted_config(self):
        replies = Replies((200, "api.e2b-foxtrot.dev"), (200, None))
        with self.client(replies, api_url="https://api.e2b.app.local") as client:
            client.get("https://api.e2b.app/a")
            client.get("https://api.e2b.app/b")

        assert replies.urls[1] == "https://api.e2b.app/b"

    async def test_async_sends_later_requests_to_the_plane(self):
        replies = Replies((200, "api.e2b-foxtrot.dev"), (401, None), (200, None))
        transport = AsyncPlaneRoutingTransport(httpx.MockTransport(replies), config())
        async with httpx.AsyncClient(transport=transport) as client:
            await client.get("https://api.e2b.app/sandboxes")
            response = await client.post("https://api.e2b.app/sandboxes", content=b"{}")

        assert response.status_code == 200
        assert replies.urls == [
            "https://api.e2b.app/sandboxes",
            "https://api.e2b-foxtrot.dev/sandboxes",
            "https://api.e2b.app/sandboxes",
        ]


class TestEnvdRouting:
    @pytest.fixture(autouse=True)
    def _plane(self):
        learn_plane(KEY, "https://api.e2b.app/sandboxes", "api.e2b-foxtrot.dev")

    def client(self, replies: Replies, routing: EnvdPlaneRouting) -> httpx.Client:
        return httpx.Client(
            transport=EnvdPlaneRoutingTransport(httpx.MockTransport(replies), routing)
        )

    def test_sends_requests_to_the_plane(self):
        replies = Replies((200, None))
        with self.client(replies, EnvdPlaneRouting(KEY, "e2b.app")) as client:
            client.get("https://sandbox.e2b.app/files?path=a")

        assert replies.urls == ["https://sandbox.e2b-foxtrot.dev/files?path=a"]

    def test_stays_on_the_configured_host_after_the_plane_answers_502(self):
        replies = Replies((502, None), (200, None), (200, None))
        with self.client(replies, EnvdPlaneRouting(KEY, "e2b.app")) as client:
            response = client.get("https://sandbox.e2b.app/a")
            client.get("https://sandbox.e2b.app/b")

        assert response.status_code == 200
        assert replies.urls == [
            "https://sandbox.e2b-foxtrot.dev/a",
            "https://sandbox.e2b.app/a",
            "https://sandbox.e2b.app/b",
        ]

    def test_keeps_routing_when_the_configured_host_answers_502_too(self):
        replies = Replies((502, None), (502, None), (200, None))
        with self.client(replies, EnvdPlaneRouting(KEY, "e2b.app")) as client:
            client.get("https://sandbox.e2b.app/a")
            client.get("https://sandbox.e2b.app/b")

        assert replies.urls[2] == "https://sandbox.e2b-foxtrot.dev/b"

    def test_falls_back_when_the_plane_cannot_be_reached(self):
        replies = Replies(connection_refused, (200, None))
        with self.client(replies, EnvdPlaneRouting(KEY, "e2b.app")) as client:
            client.get("https://sandbox.e2b.app/a")

        assert replies.urls == [
            "https://sandbox.e2b-foxtrot.dev/a",
            "https://sandbox.e2b.app/a",
        ]

    def test_leaves_other_hosts_and_unrouted_sandboxes_alone(self):
        replies = Replies((200, None), (200, None))
        with self.client(replies, EnvdPlaneRouting(KEY, "e2b.app")) as client:
            client.get("https://sandbox.example.com/a")
        with self.client(replies, EnvdPlaneRouting(None, "e2b.app")) as client:
            client.get("https://sandbox.e2b.app/b")

        assert replies.urls == [
            "https://sandbox.example.com/a",
            "https://sandbox.e2b.app/b",
        ]


class FakeRpcTransport:
    def __init__(self, *statuses):
        self.statuses = list(statuses)
        self.urls: List[str] = []

    def _next(self, url):
        self.urls.append(url)
        status = self.statuses.pop(0)
        if isinstance(status, Exception):
            raise status
        return status

    def execute_sync(self, request: SyncRequest) -> SyncResponse:
        return SyncResponse(status=self._next(request.url), content=b"")

    async def execute(self, request: Request) -> Response:
        return Response(status=self._next(request.url), content=b"")


class TestEnvdRpcRouting:
    @pytest.fixture(autouse=True)
    def _plane(self):
        learn_plane(KEY, "https://api.e2b.app/sandboxes", "api.e2b-foxtrot.dev")

    def test_sends_rpcs_to_the_plane_and_falls_back_on_502(self):
        inner = FakeRpcTransport(200, 502, 200, 200)
        transport = EnvdPlaneRoutingRpcTransport(
            inner, EnvdPlaneRouting(KEY, "e2b.app")
        )

        for path in ("a", "b", "c"):
            transport.execute_sync(
                SyncRequest(
                    "POST",
                    f"https://sandbox.e2b.app/{path}",
                    headers=Headers({}),
                    content=b"{}",
                )
            )

        assert inner.urls == [
            "https://sandbox.e2b-foxtrot.dev/a",
            "https://sandbox.e2b-foxtrot.dev/b",
            "https://sandbox.e2b.app/b",
            "https://sandbox.e2b.app/c",
        ]

    def test_does_not_send_a_streamed_body_twice(self):
        inner = FakeRpcTransport(502)
        transport = EnvdPlaneRoutingRpcTransport(
            inner, EnvdPlaneRouting(KEY, "e2b.app")
        )

        response = transport.execute_sync(
            SyncRequest("POST", "https://sandbox.e2b.app/a", content=iter([b"{}"]))
        )

        assert response.status == 502
        assert inner.urls == ["https://sandbox.e2b-foxtrot.dev/a"]

    async def test_async_falls_back_when_the_plane_cannot_be_reached(self):
        inner = FakeRpcTransport(ConnectionError("refused"), 200)
        transport = AsyncEnvdPlaneRoutingRpcTransport(
            inner, EnvdPlaneRouting(KEY, "e2b.app")
        )

        response = await transport.execute(
            Request("POST", "https://sandbox.e2b.app/a", content=b"{}")
        )

        assert response.status == 200
        assert inner.urls == [
            "https://sandbox.e2b-foxtrot.dev/a",
            "https://sandbox.e2b.app/a",
        ]
