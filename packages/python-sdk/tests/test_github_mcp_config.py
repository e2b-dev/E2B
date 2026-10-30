"""GitHub MCP config uses the gateway's camelCase wire keys."""

import json
import shlex
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from e2b import AsyncSandbox, Sandbox
from e2b.sandbox.sandbox_api import GitHubMcpServerConfig


def github_mcp_config():
    return {
        "github/example/server": GitHubMcpServerConfig(
            runCmd="node 'server name.js'",
            installCmd="npm install",
            envs={"EXAMPLE_TOKEN": "test-only"},
        )
    }


def test_github_mcp_type_declares_gateway_keys():
    annotations = GitHubMcpServerConfig.__annotations__
    assert "runCmd" in annotations
    assert "installCmd" in annotations
    assert "run_cmd" not in annotations
    assert "install_cmd" not in annotations


def test_sync_create_serializes_github_mcp_config(monkeypatch):
    config = github_mcp_config()
    run = Mock()
    sandbox = SimpleNamespace(commands=SimpleNamespace(run=run))
    monkeypatch.setattr(Sandbox, "_create", Mock(return_value=sandbox))

    assert Sandbox.create(mcp=config) is sandbox

    command = shlex.split(run.call_args.args[0])
    assert command[:2] == ["mcp-gateway", "--config"]
    assert json.loads(command[2]) == config


async def test_async_create_serializes_github_mcp_config(monkeypatch):
    config = github_mcp_config()
    run = AsyncMock()
    sandbox = SimpleNamespace(commands=SimpleNamespace(run=run))
    monkeypatch.setattr(AsyncSandbox, "_create", AsyncMock(return_value=sandbox))

    assert await AsyncSandbox.create(mcp=config) is sandbox

    command = shlex.split(run.call_args.args[0])
    assert command[:2] == ["mcp-gateway", "--config"]
    assert json.loads(command[2]) == config
