"""
`get_info` and `list_builds` of `Template` and `AsyncTemplate`, run against a
local HTTP server that stands in for the API. Every test runs for both classes.
"""

import inspect
import json
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, NamedTuple, Optional, Tuple
from urllib.parse import parse_qs, urlsplit

import pytest

from e2b import (
    AsyncTemplate,
    AsyncTemplateBuildPaginator,
    Template,
    TemplateBuildPaginator,
    TemplateBuildInfo,
    TemplateBuildStatus,
    TemplateBuildWithTags,
    TemplateDetails,
)
from e2b.connection_config import ApiParams
from e2b.exceptions import (
    InvalidArgumentException,
    TemplateException,
    TemplateNotFoundException,
)

API_KEY = "e2b_" + "0" * 40
OTHER_API_KEY = "e2b_" + "1" * 40

TEMPLATE = {
    "templateID": "abc",
    "names": ["acme/web"],
    "public": False,
    "isDefault": False,
    "buildStatus": "building",
    "buildCount": 3,
    "spawnCount": 12,
    "createdBy": None,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-16T12:00:00Z",
    "lastSpawnedAt": None,
}

# Newest first, as the API returns them.
BUILDS = [
    {
        "buildID": "00000000-0000-0000-0000-0000000000b3",
        "status": "error",
        "cpuCount": 2,
        "memoryMB": 1024,
        "createdAt": "2024-01-17T10:30:00Z",
        "updatedAt": "2024-01-17T10:31:00Z",
        "tags": [],
    },
    {
        "buildID": "00000000-0000-0000-0000-0000000000b2",
        "status": "ready",
        "cpuCount": 2,
        "maxCpuCount": 4,
        "memoryMB": 1024,
        "diskSizeMB": 5120,
        "envdVersion": "0.2.0",
        "createdAt": "2024-01-16T10:30:00Z",
        "updatedAt": "2024-01-16T10:35:00Z",
        "finishedAt": "2024-01-16T10:34:00Z",
        "tags": ["stable", "v2"],
    },
    {
        "buildID": "00000000-0000-0000-0000-0000000000b1",
        "status": "ready",
        "cpuCount": 2,
        "memoryMB": 1024,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:35:00Z",
        "tags": ["default"],
    },
]

# Template references the stand-in API answers with an error.
ERRORS: Dict[str, Tuple[int, Dict[str, Any]]] = {
    "missing": (404, {"code": 404, "message": "Template not found"}),
    "no-such-route": (404, {"code": 5, "message": "Not Found"}),
    "api-without-the-route": (
        404,
        {"code": 404, "message": "validation error: no matching operation was found"},
    ),
    "broken": (500, {"code": 500, "message": "Internal error"}),
}


class Request(NamedTuple):
    path: str
    query: Dict[str, List[str]]
    api_key: Optional[str]


class _Api(BaseHTTPRequestHandler):
    requests: List[Request] = []

    def log_message(self, *args):
        pass

    def do_GET(self):
        url = urlsplit(self.path)
        query = parse_qs(url.query, keep_blank_values=True)
        _Api.requests.append(Request(url.path, query, self.headers.get("X-API-KEY")))

        template = url.path.removesuffix("/builds").rsplit("/", 1)[-1]
        if template in ERRORS:
            self._respond(*ERRORS[template])
        elif template == "no-body":
            self._respond(204, None)
        elif url.path.endswith("/builds"):
            limit = int(query.get("limit", ["100"])[0])
            start = int(query.get("nextToken", ["0"])[0])
            more = start + limit < len(BUILDS)
            self._respond(
                200,
                BUILDS[start : start + limit],
                {"X-Next-Token": str(start + limit)} if more else {},
            )
        elif template == "first-build":
            self._respond(200, {**TEMPLATE, "description": ""})
        else:
            self._respond(
                200,
                {
                    **TEMPLATE,
                    "description": "Web server",
                    "lastSpawnedAt": "2024-01-17T08:00:00Z",
                    "defaultBuild": {k: v for k, v in BUILDS[1].items() if k != "tags"},
                },
            )

    def _respond(self, status: int, body, headers: Optional[Dict[str, str]] = None):
        payload = b"" if body is None else json.dumps(body).encode()
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        if body is not None:
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


@pytest.fixture(scope="module")
def api_url():
    server = ThreadingHTTPServer(("127.0.0.1", 0), _Api)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.fixture
def api(api_url) -> ApiParams:
    """Connection parameters of a stand-in API; its requests are in `_Api.requests`."""
    _Api.requests = []
    return {"api_key": API_KEY, "api_url": api_url}


@pytest.fixture(params=[Template, AsyncTemplate], ids=["sync", "async"])
def template_cls(request):
    return request.param


async def result(value):
    """A value of the sync class as it is, one of the async class awaited."""
    return await value if inspect.isawaitable(value) else value


async def get_info(template_cls, name_or_id, **kwargs):
    return await result(template_cls.get_info(name_or_id, **kwargs))


async def first_page(template_cls, name_or_id, **kwargs):
    return await result(template_cls.list_builds(name_or_id, **kwargs).next_items())


# What both methods have in common is tested through each of them.
both_methods = pytest.mark.parametrize(
    "call", [get_info, first_page], ids=["get_info", "list_builds"]
)

READY_BUILD: Dict[str, Any] = dict(
    build_id="00000000-0000-0000-0000-0000000000b2",
    status=TemplateBuildStatus.READY,
    cpu_count=2,
    max_cpu_count=4,
    memory_mb=1024,
    disk_size_mb=5120,
    envd_version="0.2.0",
    created_at=datetime(2024, 1, 16, 10, 30, tzinfo=timezone.utc),
    updated_at=datetime(2024, 1, 16, 10, 35, tzinfo=timezone.utc),
    finished_at=datetime(2024, 1, 16, 10, 34, tzinfo=timezone.utc),
)

TEMPLATE_DETAILS: Dict[str, Any] = dict(
    template_id="abc",
    names=["acme/web"],
    public=False,
    is_default=False,
    build_status=TemplateBuildStatus.BUILDING,
    build_count=3,
    spawn_count=12,
    created_at=datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc),
    updated_at=datetime(2024, 1, 16, 12, 0, tzinfo=timezone.utc),
)


async def test_get_info_returns_template_with_default_build(template_cls, api):
    assert await get_info(template_cls, "abc", **api) == TemplateDetails(
        **TEMPLATE_DETAILS,
        description="Web server",
        last_spawned_at=datetime(2024, 1, 17, 8, 0, tzinfo=timezone.utc),
        default_build=TemplateBuildInfo(**READY_BUILD),
    )


async def test_get_info_before_first_ready_build_has_no_default_build(
    template_cls, api
):
    # The stand-in API also sends an empty description, which reads as none.
    assert await get_info(template_cls, "first-build", **api) == TemplateDetails(
        **TEMPLATE_DETAILS
    )


async def test_get_info_fails_when_api_answers_without_a_template(template_cls, api):
    with pytest.raises(TemplateException, match="^Failed to get template info$"):
        await get_info(template_cls, "no-body", **api)


async def test_list_builds_pages_through_builds(template_cls, api):
    paginator = template_cls.list_builds("abc", limit=2, **api)

    first = await result(paginator.next_items())
    assert [build.build_id[-2:] for build in first] == ["b3", "b2"]
    assert (paginator.has_next, paginator.next_token) == (True, "2")

    second = await result(paginator.next_items())
    assert [build.build_id[-2:] for build in second] == ["b1"]
    assert paginator.has_next is False

    with pytest.raises(Exception, match="No more items"):
        await result(paginator.next_items())


async def test_list_builds_starts_from_next_token(template_cls, api):
    builds = await first_page(template_cls, "abc", next_token="2", **api)

    assert [build.build_id[-2:] for build in builds] == ["b1"]


async def test_list_builds_maps_builds(template_cls, api):
    failed, resizable, _ = await first_page(template_cls, "abc", **api)

    assert failed == TemplateBuildWithTags(
        build_id="00000000-0000-0000-0000-0000000000b3",
        status=TemplateBuildStatus.ERROR,
        cpu_count=2,
        memory_mb=1024,
        created_at=datetime(2024, 1, 17, 10, 30, tzinfo=timezone.utc),
        updated_at=datetime(2024, 1, 17, 10, 31, tzinfo=timezone.utc),
        tags=[],
    )
    assert resizable == TemplateBuildWithTags(**READY_BUILD, tags=["stable", "v2"])


@pytest.mark.parametrize(
    "filters, sent",
    [
        (
            {
                "statuses": [TemplateBuildStatus.READY, TemplateBuildStatus.ERROR],
                "tags": ["default", "v2"],
            },
            {"statuses": ["ready,error"], "tags": ["default,v2"]},
        ),
        # statuses as strings, one value without a list
        ({"statuses": ["ready", "error"]}, {"statuses": ["ready,error"]}),
        (
            {"statuses": TemplateBuildStatus.READY, "tags": "v2"},
            {"statuses": ["ready"], "tags": ["v2"]},
        ),
        # a status given twice is sent once
        ({"statuses": ["ready", "error", "ready"]}, {"statuses": ["ready,error"]}),
        # an empty filter is not sent
        ({"statuses": [], "tags": []}, {}),
    ],
)
async def test_list_builds_sends_filters(template_cls, api, filters, sent):
    await first_page(template_cls, "abc", **filters, **api)

    query = _Api.requests[0].query
    assert {name: query[name] for name in ("statuses", "tags") if name in query} == sent


async def test_list_builds_sends_the_same_filters_for_every_page(template_cls, api):
    tags = ["default"]
    paginator = template_cls.list_builds(
        "abc",
        statuses=(status for status in [TemplateBuildStatus.READY]),
        tags=tags,
        limit=2,
        **api,
    )
    tags.append("v2")

    await result(paginator.next_items())
    await result(paginator.next_items())

    assert [request.query["statuses"] for request in _Api.requests] == [["ready"]] * 2
    assert [request.query["tags"] for request in _Api.requests] == [["default"]] * 2


@pytest.mark.parametrize(
    "filters, message",
    [
        (
            {"statuses": ["done"]},
            "Unknown build status 'done', expected one of: building, waiting, ready, error.",
        ),
        (
            {"tags": ["v2", ""]},
            "Invalid tag '': a tag must not be empty or contain a comma.",
        ),
        (
            {"tags": ["v2", " "]},
            "Invalid tag ' ': a tag must not be empty or contain a comma.",
        ),
        (
            {"tags": ["v1,v2"]},
            "Invalid tag 'v1,v2': a tag must not be empty or contain a comma.",
        ),
    ],
)
def test_list_builds_rejects_filter(template_cls, api, filters, message):
    with pytest.raises(InvalidArgumentException) as error:
        template_cls.list_builds("abc", **filters, **api)

    assert str(error.value) == message
    assert _Api.requests == []


@pytest.mark.parametrize(
    "paginator_cls", [TemplateBuildPaginator, AsyncTemplateBuildPaginator]
)
def test_build_paginator_takes_its_options_by_keyword_only(paginator_cls):
    with pytest.raises(TypeError):
        paginator_cls("abc", [TemplateBuildStatus.READY])


async def test_list_builds_failed_page_can_be_fetched_again(template_cls, api):
    paginator = template_cls.list_builds("broken", **api)

    with pytest.raises(TemplateException):
        await result(paginator.next_items())

    assert paginator.has_next is True


async def test_list_builds_per_call_params_override_the_paginator_params(
    template_cls, api
):
    paginator = template_cls.list_builds("abc", **api)

    await result(paginator.next_items(api_key=OTHER_API_KEY))

    assert [request.api_key for request in _Api.requests] == [OTHER_API_KEY]


@both_methods
async def test_encodes_namespaced_name(template_cls, api, call):
    await call(template_cls, "acme/web", **api)

    assert "/acme%2Fweb" in _Api.requests[0].path


@both_methods
async def test_uses_bound_params(template_cls, api, call):
    class BoundTemplate(template_cls):
        _bound_api_params: ApiParams = {**api, "api_key": OTHER_API_KEY}

    await call(BoundTemplate, "abc")

    assert [request.api_key for request in _Api.requests] == [OTHER_API_KEY]


@both_methods
async def test_raises_not_found_exception(template_cls, api, call):
    with pytest.raises(
        TemplateNotFoundException, match="^Template 'missing' not found$"
    ) as error:
        await call(template_cls, "missing", **api)

    assert isinstance(error.value, TemplateException)
    assert error.value.status_code == 404


@both_methods
@pytest.mark.parametrize(
    "name_or_id, message",
    # 404s that are not the API's "not found" answer, and another failure
    [
        ("no-such-route", "404: Not Found"),
        (
            "api-without-the-route",
            "404: validation error: no matching operation was found",
        ),
        ("broken", "500: Internal error"),
    ],
)
async def test_raises_template_exception_on_other_failures(
    template_cls, api, call, name_or_id, message
):
    with pytest.raises(TemplateException) as error:
        await call(template_cls, name_or_id, **api)

    assert str(error.value) == message
    assert not isinstance(error.value, TemplateNotFoundException)


@both_methods
@pytest.mark.parametrize(
    "name_or_id, message",
    [
        (
            "acme/web:v2",
            "Expected a template name or ID without a tag, got 'acme/web:v2'. "
            "To read the build a tag points at, pass the tag to "
            "list_builds(name_or_id, tags=[tag]).",
        ),
        ("", "Invalid template name or ID ''."),
        (".", "Invalid template name or ID '.'."),
        ("..", "Invalid template name or ID '..'."),
    ],
)
async def test_rejects_name(template_cls, api, call, name_or_id, message):
    with pytest.raises(InvalidArgumentException) as error:
        await call(template_cls, name_or_id, **api)

    assert str(error.value) == message
    assert _Api.requests == []


@both_methods
async def test_rejects_name_before_any_api_key_is_needed(
    template_cls, call, monkeypatch
):
    monkeypatch.delenv("E2B_API_KEY", raising=False)

    with pytest.raises(InvalidArgumentException):
        await call(template_cls, "acme/web:v2")
