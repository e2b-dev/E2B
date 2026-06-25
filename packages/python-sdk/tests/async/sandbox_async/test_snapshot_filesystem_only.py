import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_pause_filesystem_only(async_sandbox: AsyncSandbox):
    # A marker on the persisted rootfs and the kernel boot id before pausing.
    await async_sandbox.files.write("/home/user/fs-only-marker.txt", "persisted")
    boot_before = (
        await async_sandbox.files.read("/proc/sys/kernel/random/boot_id")
    ).strip()

    # Filesystem-only pause: only the rootfs is persisted, no memory snapshot.
    assert await async_sandbox.pause(keep_memory=False)
    assert not await async_sandbox.is_running()

    # Resuming a filesystem-only snapshot cold-boots (reboots) from the rootfs.
    resumed = await async_sandbox.connect()
    assert await resumed.is_running()
    assert resumed.sandbox_id == async_sandbox.sandbox_id

    # connect() returns the same handle, and its credentials stay valid across
    # the resume (the backend re-binds the same envd access token on the cold
    # boot). The rootfs survives the reboot...
    marker = (await resumed.files.read("/home/user/fs-only-marker.txt")).strip()
    assert marker == "persisted"

    # ...while a fresh kernel boot id proves the guest cold-booted rather than
    # being restored from a memory snapshot.
    boot_after = (await resumed.files.read("/proc/sys/kernel/random/boot_id")).strip()
    assert boot_after != boot_before
