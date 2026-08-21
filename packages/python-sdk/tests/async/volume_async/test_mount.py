"""Async counterpart of `tests/sync/volume_sync/test_mount.py`."""

from uuid import uuid4

import pytest

from e2b import AsyncSandbox, AsyncVolume


@pytest.mark.e2e
@pytest.mark.skip_debug()
async def test_mounted_volume_persists_content_across_sandboxes(template):
    volume = await AsyncVolume.create(f"test-mount-{uuid4()}")

    try:
        writer = await AsyncSandbox.create(
            template, volume_mounts={"/mnt/data": volume}
        )
        try:
            await writer.files.write("/mnt/data/hello.txt", "written by the writer")
        finally:
            await writer.kill()

        reader = await AsyncSandbox.create(
            template, volume_mounts={"/mnt/data": volume}
        )
        try:
            assert (
                await reader.files.read("/mnt/data/hello.txt")
                == "written by the writer"
            )
        finally:
            await reader.kill()
    finally:
        await AsyncVolume.destroy(volume.volume_id)
