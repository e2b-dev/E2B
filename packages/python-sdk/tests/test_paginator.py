from urllib.parse import parse_qs, urlsplit

import pytest
from local_api_server import API_KEY, local_api_server

from e2b import AsyncSandbox, Sandbox


def _listed_sandbox(sandbox_id: str) -> dict:
    return {
        "templateID": "base",
        "sandboxID": sandbox_id,
        "clientID": "client-test",
        "startedAt": "2026-01-01T00:00:00Z",
        "endAt": "2026-01-01T01:00:00Z",
        "cpuCount": 2,
        "memoryMB": 512,
        "diskSizeMB": 1024,
        "state": "running",
        "envdVersion": "0.2.0",
    }


def _paged_list_server(pages):
    """Serves `GET /v2/sandboxes`, keyed by the `nextToken` query param."""

    def respond(method, path):
        url = urlsplit(path)
        if method != "GET" or url.path != "/v2/sandboxes":
            return 404, {"code": 404, "message": "not found"}, None
        token = parse_qs(url.query).get("nextToken", [None])[0]
        ids, next_token = pages[token]
        headers = {"x-next-token": next_token} if next_token else None
        return 200, [_listed_sandbox(i) for i in ids], headers

    return local_api_server(respond)


def _sent_tokens(server):
    return [
        parse_qs(urlsplit(r.path).query).get("nextToken", [None])[0]
        for r in server.requests
    ]


TWO_PAGES = {None: (["sbx-a", "sbx-b"], "tok-2"), "tok-2": (["sbx-c"], None)}
ONE_PAGE = {None: ([], None)}


def test_sandbox_list_paginator_exposes_state_and_advances():
    with _paged_list_server(TWO_PAGES) as server:
        paginator = Sandbox.list(api_key=API_KEY, api_url=server.url)

        assert paginator.has_next is True
        assert paginator.next_token is None

        first = paginator.next_items()
        assert [s.sandbox_id for s in first] == ["sbx-a", "sbx-b"]
        assert paginator.has_next is True
        assert paginator.next_token == "tok-2"

        second = paginator.next_items()
        assert [s.sandbox_id for s in second] == ["sbx-c"]
        assert paginator.has_next is False
        assert paginator.next_token is None

        assert _sent_tokens(server) == [None, "tok-2"]


def test_sandbox_list_paginator_raises_once_exhausted():
    with _paged_list_server(ONE_PAGE) as server:
        paginator = Sandbox.list(api_key=API_KEY, api_url=server.url)
        assert paginator.next_items() == []

        assert paginator.has_next is False
        with pytest.raises(Exception, match="No more items to fetch"):
            paginator.next_items()
        assert len(server.requests) == 1


async def test_async_sandbox_list_paginator_exposes_state_and_advances():
    with _paged_list_server(TWO_PAGES) as server:
        paginator = AsyncSandbox.list(api_key=API_KEY, api_url=server.url)

        assert paginator.has_next is True
        assert paginator.next_token is None

        first = await paginator.next_items()
        assert [s.sandbox_id for s in first] == ["sbx-a", "sbx-b"]
        assert paginator.has_next is True
        assert paginator.next_token == "tok-2"

        second = await paginator.next_items()
        assert [s.sandbox_id for s in second] == ["sbx-c"]
        assert paginator.has_next is False
        assert paginator.next_token is None

        assert _sent_tokens(server) == [None, "tok-2"]


async def test_async_sandbox_list_paginator_raises_once_exhausted():
    with _paged_list_server(ONE_PAGE) as server:
        paginator = AsyncSandbox.list(api_key=API_KEY, api_url=server.url)
        assert await paginator.next_items() == []

        assert paginator.has_next is False
        with pytest.raises(Exception, match="No more items to fetch"):
            await paginator.next_items()
        assert len(server.requests) == 1
