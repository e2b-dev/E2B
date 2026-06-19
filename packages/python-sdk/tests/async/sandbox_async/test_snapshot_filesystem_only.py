import pytest
from e2b import AsyncSandbox


@pytest.mark.skip_debug()
async def test_pause_filesystem_only(async_sandbox: AsyncSandbox):
    # A marker on the persisted rootfs and the kernel boot id before pausing.
    await async_sandbox.commands.run("echo persisted > /home/user/fs-only-marker.txt")
    boot_before = (
        await async_sandbox.commands.run("cat /proc/sys/kernel/random/boot_id")
    ).stdout.strip()

    # Filesystem-only pause: only the rootfs is persisted, no memory snapshot.
    assert await async_sandbox.pause(keep_memory=False)
    assert not await async_sandbox.is_running()

    # Resuming a filesystem-only snapshot cold-boots (reboots) from the rootfs.
    resumed = await async_sandbox.connect()
    assert await resumed.is_running()
    assert resumed.sandbox_id == async_sandbox.sandbox_id

    # Use the resumed handle for guest (envd) operations: the cold boot
    # re-initializes envd, so the pre-pause handle's connection is stale.
    # The rootfs survives the reboot...
    marker = (
        await resumed.commands.run("cat /home/user/fs-only-marker.txt")
    ).stdout.strip()
    assert marker == "persisted"

    # ...while a fresh kernel boot id proves the guest cold-booted rather than
    # being restored from a memory snapshot.
    boot_after = (
        await resumed.commands.run("cat /proc/sys/kernel/random/boot_id")
    ).stdout.strip()
    assert boot_after != boot_before
