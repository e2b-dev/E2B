from typing import Any, cast
from unittest.mock import AsyncMock, Mock, patch

import pytest
from packaging.version import Version

from e2b import AsyncVolume, InvalidArgumentException, Volume
from e2b.connection_config import ConnectionConfig
from e2b.sandbox_async.filesystem.filesystem import Filesystem as AsyncFilesystem
from e2b.sandbox_sync.filesystem.filesystem import Filesystem

API_KEY = "e2b_" + "0" * 40


def _sync_fs() -> Filesystem:
    envd = Mock()
    envd.get.side_effect = AssertionError("GET should not be called")
    return Filesystem(
        "http://127.0.0.1:9",
        Version("1.0.0"),
        ConnectionConfig(api_key=API_KEY),
        envd,
    )


def _async_fs() -> AsyncFilesystem:
    envd = Mock()
    envd.get = AsyncMock(side_effect=AssertionError("GET should not be called"))
    return AsyncFilesystem(
        "http://127.0.0.1:9",
        Version("1.0.0"),
        ConnectionConfig(api_key=API_KEY),
        envd,
    )


def test_sync_filesystem_read_rejects_unrecognized_format():
    fs = _sync_fs()
    with pytest.raises(InvalidArgumentException, match="format must be one of"):
        fs.read("/tmp/x", cast(Any, "Text"))


async def test_async_filesystem_read_rejects_unrecognized_format():
    fs = _async_fs()
    with pytest.raises(InvalidArgumentException, match="format must be one of"):
        await fs.read("/tmp/x", cast(Any, "Text"))


def test_sync_volume_read_file_rejects_unrecognized_format():
    vol = Volume("vol", "name", "tok")
    with patch(
        "e2b.volume.volume_sync.get_volume_api_client",
        side_effect=AssertionError("GET should not be called"),
    ) as client:
        with pytest.raises(InvalidArgumentException, match="format must be one of"):
            vol.read_file("/x", cast(Any, "Text"))
        client.assert_not_called()


async def test_async_volume_read_file_rejects_unrecognized_format():
    vol = AsyncVolume("vol", "name", "tok")
    with patch(
        "e2b.volume.volume_async.get_volume_api_client",
        side_effect=AssertionError("GET should not be called"),
    ) as client:
        with pytest.raises(InvalidArgumentException, match="format must be one of"):
            await vol.read_file("/x", cast(Any, "Text"))
        client.assert_not_called()
