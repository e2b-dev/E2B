"""Offline coverage for the ``mcp`` create option.

These exercise the branches of ``create`` that decide the template and the
gateway command from ``mcp``, without reaching the API. The generated
``e2b.sandbox.mcp`` types describe what a caller may put in the mapping; nothing
else pins what the SDK then does with it.
"""

import json
from types import SimpleNamespace
from typing import Any, List, Optional

import pytest

from e2b import AsyncSandbox, Sandbox
from e2b.api.client.api.sandboxes import post_sandboxes
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.sandbox.mcp import McpServer
from e2b.sandbox_async.commands.command import Commands as AsyncCommands
from e2b.sandbox_sync.commands.command import Commands as SyncCommands

# Annotated so `ty check` fails if a refreshed catalog renames these servers or
# their properties. Nothing else in either SDK typechecks a real MCP mapping.
DOCKER: McpServer = {"docker": {}}
N8N: McpServer = {"n8n": {"apiUrl": "https://n8n.example.com/api/v1", "apiKey": "key"}}
EMPTY: McpServer = {}


class _Created:
    """Records the create request body and the commands run after create."""

    def __init__(self, is_async: bool) -> None:
        self._is_async = is_async
        self.body: Optional[dict] = None
        self.commands: List[str] = []

    def _respond(self, body: Any) -> SimpleNamespace:
        self.body = body.to_dict()
        return SimpleNamespace(
            status_code=200,
            parsed=SandboxModel(
                template_id=body.template_id,
                sandbox_id="sandbox-id",
                client_id="client-id",
                envd_version="0.2.0",
            ),
        )

    async def create(self, mcp: Optional[McpServer], **kwargs) -> None:
        if self._is_async:
            await AsyncSandbox.create(mcp=mcp, **kwargs)
        else:
            Sandbox.create(mcp=mcp, **kwargs)

    @property
    def default_mcp_template(self) -> str:
        return (
            AsyncSandbox.default_mcp_template
            if self._is_async
            else (Sandbox.default_mcp_template)
        )

    @property
    def default_template(self) -> str:
        return (
            AsyncSandbox.default_template
            if self._is_async
            else (Sandbox.default_template)
        )


@pytest.fixture(params=[False, True], ids=["sync", "async"])
def created(request, monkeypatch) -> _Created:
    recorder = _Created(is_async=request.param)

    if request.param:

        async def fake_create(*, body, client):
            return recorder._respond(body)

        async def fake_run(self, cmd, **kwargs):
            recorder.commands.append(cmd)
            return SimpleNamespace(exit_code=0, stdout="", stderr="")

        monkeypatch.setattr(post_sandboxes, "asyncio_detailed", fake_create)
        monkeypatch.setattr(AsyncCommands, "run", fake_run)
    else:

        def fake_create(*, body, client):
            return recorder._respond(body)

        def fake_run(self, cmd, **kwargs):
            recorder.commands.append(cmd)
            return SimpleNamespace(exit_code=0, stdout="", stderr="")

        monkeypatch.setattr(post_sandboxes, "sync_detailed", fake_create)
        monkeypatch.setattr(SyncCommands, "run", fake_run)

    return recorder


async def test_mcp_option_selects_the_gateway_template_and_reaches_the_request(created):
    await created.create(DOCKER)

    assert created.body is not None
    assert created.body["templateID"] == created.default_mcp_template
    assert created.body["mcp"] == DOCKER


async def test_mcp_option_starts_the_gateway_with_the_configuration_verbatim(created):
    await created.create(N8N)

    assert len(created.commands) == 1
    command = created.commands[0]
    assert command.startswith("mcp-gateway --config ")
    config = command.removeprefix("mcp-gateway --config ").strip("'")
    assert json.loads(config) == N8N


async def test_explicit_template_is_not_replaced_by_the_gateway_template(created):
    await created.create(DOCKER, template="custom-template")

    assert created.body["templateID"] == "custom-template"


async def test_no_mcp_option_keeps_the_default_template_and_omits_mcp(created):
    await created.create(None)

    assert created.body["templateID"] == created.default_template
    assert "mcp" not in created.body
    assert created.commands == []


async def test_empty_mcp_mapping_starts_the_gateway_but_is_omitted_from_the_request(
    created,
):
    """An empty mapping is a valid ``McpServer`` value, and the two code paths
    disagree about it: ``create`` treats it as "MCP requested" (``is not None``)
    while the request body drops it (``mcp or UNSET``, and an empty dict is
    falsy). The JS SDK sends ``mcp: {}`` in the same situation, so this pins
    current behaviour rather than endorsing it.
    """
    await created.create(EMPTY)

    assert created.body["templateID"] == created.default_mcp_template
    assert "mcp" not in created.body
    assert created.commands == ["mcp-gateway --config '{}'"]
