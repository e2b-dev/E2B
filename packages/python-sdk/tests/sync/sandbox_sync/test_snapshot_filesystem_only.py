import pytest
from e2b import Sandbox, SandboxException

pytestmark = pytest.mark.timeout(270)


@pytest.mark.skip_debug()
def test_pause_filesystem_only(sandbox: Sandbox):
    # A marker on the persisted rootfs and the kernel boot id before pausing.
    sandbox.files.write("/home/user/fs-only-marker.txt", "persisted")
    boot_before = sandbox.files.read("/proc/sys/kernel/random/boot_id").strip()

    # Filesystem-only pause: only the rootfs is persisted, no memory snapshot.
    assert sandbox.pause(keep_memory=False, request_timeout=120)
    assert not sandbox.is_running()

    # Resuming a filesystem-only snapshot cold-boots (reboots) from the rootfs.
    try:
        resumed = sandbox.connect(request_timeout=120)
    except SandboxException as error:
        # Placement can transiently time out while the cold boot is scheduled.
        # Retry only the backend response that explicitly asks the caller to do so.
        if "Failed to place sandbox: placement timed out" not in str(error):
            raise
        resumed = sandbox.connect(request_timeout=120)
    assert resumed.is_running()
    assert resumed.sandbox_id == sandbox.sandbox_id

    # connect() returns the same handle, and its credentials stay valid across
    # the resume (the backend re-binds the same envd access token on the cold
    # boot). The rootfs survives the reboot...
    marker = resumed.files.read("/home/user/fs-only-marker.txt").strip()
    assert marker == "persisted"

    # ...while a fresh kernel boot id proves the guest cold-booted rather than
    # being restored from a memory snapshot.
    boot_after = resumed.files.read("/proc/sys/kernel/random/boot_id").strip()
    assert boot_after != boot_before
