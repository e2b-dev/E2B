"""Tests for the GitHub MCP server key mapping (e2b-dev/E2B#1899).

The Python SDK documents snake_case keys (``run_cmd``/``install_cmd``) for
``GitHubMcpServerConfig``, but the mcp-gateway only recognizes camelCase
(``runCmd``/``installCmd``). ``Sandbox.create``/``AsyncSandbox.create`` must
map the keys to the wire form before the config reaches the gateway.
"""

import json
import shlex
from types import SimpleNamespace
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock

from e2b import AsyncSandbox, Sandbox
from e2b.api.client.api.sandboxes import post_v2_sandboxes
from e2b.api.client.models import Sandbox as SandboxModel
from e2b.sandbox.sandbox_api import GitHubMcpServer, build_mcp_wire_config


def _gateway_config_from_command(command: str) -> Dict[str, Any]:
    argv = shlex.split(command)
    assert argv[:2] == ["mcp-gateway", "--config"]
    return json.loads(argv[2])


def _github_mcp(config: Dict[str, Any]) -> GitHubMcpServer:
    return {"github/tenuo-ai/tenuo-demos": config}


def test_maps_snake_case_keys_to_wire_names():
    wire = build_mcp_wire_config(
        _github_mcp({"install_cmd": "npm install", "run_cmd": "npx start"})
    )

    assert wire == {
        "github/tenuo-ai/tenuo-demos": {
            "installCmd": "npm install",
            "runCmd": "npx start",
        }
    }


def test_partial_config_without_install_cmd():
    mcp: GitHubMcpServer = {"github/owner/repo": {"run_cmd": "cat"}}

    assert build_mcp_wire_config(mcp) == {"github/owner/repo": {"runCmd": "cat"}}


def test_envs_and_unknown_keys_pass_through():
    mcp: GitHubMcpServer = {
        "github/owner/repo": {"run_cmd": "cat", "envs": {"FOO": "bar"}}
    }

    assert build_mcp_wire_config(mcp) == {
        "github/owner/repo": {"runCmd": "cat", "envs": {"FOO": "bar"}}
    }


def test_base_server_entries_are_untouched():
    mcp = {
        "airtable": {"airtableApiKey": "key", "nodeenv": "production"},
        **_github_mcp({"run_cmd": "cat"}),
    }

    wire = build_mcp_wire_config(mcp)

    assert wire["airtable"] == {"airtableApiKey": "key", "nodeenv": "production"}
    assert wire["github/tenuo-ai/tenuo-demos"] == {"runCmd": "cat"}


def test_explicit_wire_key_wins_over_snake_case_alias():
    config: Dict[str, Any] = {"run_cmd": "ignored", "runCmd": "cat"}
    mcp: GitHubMcpServer = {"github/owner/repo": config}

    assert build_mcp_wire_config(mcp) == {"github/owner/repo": {"runCmd": "cat"}}


def test_does_not_mutate_input():
    mcp = _github_mcp({"install_cmd": "make", "run_cmd": "cat"})

    build_mcp_wire_config(mcp)

    assert mcp == {
        "github/tenuo-ai/tenuo-demos": {"install_cmd": "make", "run_cmd": "cat"}
    }


def test_empty_config():
    assert build_mcp_wire_config({}) == {}


def _created_sandbox():
    return SimpleNamespace(
        status_code=200,
        parsed=SandboxModel(
            client_id="client-id",
            envd_version="0.2.4",
            sandbox_id="sbx-test",
            template_id="template-id",
        ),
    )


def _expected_wire() -> Dict[str, Any]:
    return {
        "github/tenuo-ai/tenuo-demos": {
            "installCmd": "echo hi",
            "runCmd": "cat",
        }
    }


def test_sync_create_sends_wire_names_to_api_and_gateway(monkeypatch, test_api_key):
    request = Mock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "sync_detailed", request)
    gateway_run = Mock()
    monkeypatch.setattr("e2b.sandbox_sync.commands.command.Commands.run", gateway_run)

    Sandbox.create(
        api_key=test_api_key,
        mcp=_github_mcp({"install_cmd": "echo hi", "run_cmd": "cat"}),
    )

    body = request.call_args.kwargs["body"].to_dict()
    assert body["mcp"] == _expected_wire()

    command = gateway_run.call_args.args[0]
    assert _gateway_config_from_command(command) == _expected_wire()


async def test_async_create_sends_wire_names_to_api_and_gateway(
    monkeypatch, test_api_key
):
    request = AsyncMock(return_value=_created_sandbox())
    monkeypatch.setattr(post_v2_sandboxes, "asyncio_detailed", request)
    gateway_run = AsyncMock()
    monkeypatch.setattr("e2b.sandbox_async.commands.command.Commands.run", gateway_run)

    await AsyncSandbox.create(
        api_key=test_api_key,
        mcp=_github_mcp({"install_cmd": "echo hi", "run_cmd": "cat"}),
    )

    body = request.call_args.kwargs["body"].to_dict()
    assert body["mcp"] == _expected_wire()

    command = gateway_run.call_args.args[0]
    assert _gateway_config_from_command(command) == _expected_wire()
