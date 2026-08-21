"""Volume content persisting across sandboxes — real mounts, real compute.

Everything else about volumes (CRUD, pagination, error mapping, the content
API) is asserted against a mocked transport in the default tier; only the mount
behavior needs live infrastructure. Mirrors `tests/volume/mount.test.ts`.
"""

from uuid import uuid4

import pytest

from e2b import Sandbox, Volume


@pytest.mark.e2e
@pytest.mark.skip_debug()
def test_mounted_volume_persists_content_across_sandboxes(template):
    volume = Volume.create(f"test-mount-{uuid4()}")

    try:
        writer = Sandbox.create(template, volume_mounts={"/mnt/data": volume})
        try:
            writer.files.write("/mnt/data/hello.txt", "written by the writer")
        finally:
            writer.kill()

        reader = Sandbox.create(template, volume_mounts={"/mnt/data": volume})
        try:
            assert reader.files.read("/mnt/data/hello.txt") == "written by the writer"
        finally:
            reader.kill()
    finally:
        Volume.destroy(volume.volume_id)
