"""Async counterpart of `tests/sync/sandbox_sync/test_version_gates.py`."""

import httpx
import pytest
from packaging.version import Version

from e2b.connection_config import ConnectionConfig
from e2b.exceptions import SandboxException, TemplateException
from e2b.sandbox_async.commands.command import Commands
from e2b.sandbox_async.filesystem.filesystem import Filesystem

ENVD_URL = "https://49983-sbx-version-gate.sandbox.e2b.dev"


def _on_event(event) -> None:
    raise AssertionError("watch event handler should not be called")


def _commands(envd_version: str, api_key: str) -> Commands:
    return Commands(
        ENVD_URL,
        ConnectionConfig(api_key=api_key),
        Version(envd_version),
        httpx.AsyncClient(),
    )


def _filesystem(envd_version: str, api_key: str) -> Filesystem:
    return Filesystem(
        ENVD_URL,
        Version(envd_version),
        ConnectionConfig(api_key=api_key),
        httpx.AsyncClient(),
    )


async def test_run_rejects_disabling_stdin_below_envd_commands_stdin(test_api_key):
    commands = _commands("0.2.9", test_api_key)

    with pytest.raises(SandboxException, match="can't specify stdin"):
        await commands.run("echo hello", stdin=False)


async def test_watch_dir_rejects_recursive_on_old_envd(test_api_key):
    filesystem = _filesystem("0.1.3", test_api_key)

    with pytest.raises(TemplateException, match="recursive watching"):
        await filesystem.watch_dir("/home/user", _on_event, recursive=True)


async def test_watch_dir_rejects_include_entry_on_old_envd(test_api_key):
    filesystem = _filesystem("0.6.2", test_api_key)

    with pytest.raises(TemplateException, match="entry info"):
        await filesystem.watch_dir("/home/user", _on_event, include_entry=True)


async def test_watch_dir_rejects_network_mounts_on_old_envd(test_api_key):
    filesystem = _filesystem("0.6.3", test_api_key)

    with pytest.raises(TemplateException, match="network mounts"):
        await filesystem.watch_dir("/home/user", _on_event, allow_network_mounts=True)


async def test_write_rejects_metadata_on_old_envd(test_api_key):
    filesystem = _filesystem("0.6.1", test_api_key)

    with pytest.raises(TemplateException, match="File metadata requires"):
        await filesystem.write("/home/user/a.txt", "hello", metadata={"key": "value"})
