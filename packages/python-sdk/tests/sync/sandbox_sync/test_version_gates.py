"""Client-side envd version gating — no sandbox, no network.

The SDK refuses options the sandbox's envd is too old to honor before it sends
anything, so these assertions only need a `Commands`/`Filesystem` bound to a
version. Mirrors `tests/sandbox/versionGates.test.ts` in the JS SDK.
"""

import httpx
import pytest
from packaging.version import Version

from envd_versions import below_envd_version

from e2b.connection_config import ConnectionConfig
from e2b.envd.versions import (
    ENVD_COMMANDS_STDIN,
    ENVD_FILE_METADATA,
    ENVD_VERSION_FS_EVENT_ENTRY_INFO,
    ENVD_VERSION_RECURSIVE_WATCH,
    ENVD_VERSION_WATCH_NETWORK_MOUNTS,
)
from e2b.exceptions import SandboxException, TemplateException
from e2b.sandbox_sync.commands.command import Commands
from e2b.sandbox_sync.filesystem.filesystem import Filesystem

ENVD_URL = "https://49983-sbx-version-gate.sandbox.e2b.dev"


def _commands(envd_version: str, api_key: str) -> Commands:
    return Commands(
        ENVD_URL,
        ConnectionConfig(api_key=api_key),
        Version(envd_version),
        httpx.Client(),
    )


def _filesystem(envd_version: str, api_key: str) -> Filesystem:
    return Filesystem(
        ENVD_URL,
        Version(envd_version),
        ConnectionConfig(api_key=api_key),
        httpx.Client(),
    )


def test_run_rejects_disabling_stdin_below_envd_commands_stdin(test_api_key):
    commands = _commands(below_envd_version(ENVD_COMMANDS_STDIN), test_api_key)

    with pytest.raises(SandboxException, match="can't specify stdin"):
        commands.run("echo hello", stdin=False)


def test_watch_dir_rejects_recursive_on_old_envd(test_api_key):
    filesystem = _filesystem(
        below_envd_version(ENVD_VERSION_RECURSIVE_WATCH), test_api_key
    )

    with pytest.raises(TemplateException, match="recursive watching"):
        filesystem.watch_dir("/home/user", recursive=True)


def test_watch_dir_rejects_include_entry_on_old_envd(test_api_key):
    filesystem = _filesystem(
        below_envd_version(ENVD_VERSION_FS_EVENT_ENTRY_INFO), test_api_key
    )

    with pytest.raises(TemplateException, match="entry info"):
        filesystem.watch_dir("/home/user", include_entry=True)


def test_watch_dir_rejects_network_mounts_on_old_envd(test_api_key):
    filesystem = _filesystem(
        below_envd_version(ENVD_VERSION_WATCH_NETWORK_MOUNTS), test_api_key
    )

    with pytest.raises(TemplateException, match="network mounts"):
        filesystem.watch_dir("/home/user", allow_network_mounts=True)


def test_write_rejects_metadata_on_old_envd(test_api_key):
    filesystem = _filesystem(below_envd_version(ENVD_FILE_METADATA), test_api_key)

    with pytest.raises(TemplateException, match="File metadata requires"):
        filesystem.write("/home/user/a.txt", "hello", metadata={"key": "value"})
