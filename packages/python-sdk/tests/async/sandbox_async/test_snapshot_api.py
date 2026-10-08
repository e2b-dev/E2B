import pytest
from e2b import AsyncSandbox, SandboxException

pytestmark = pytest.mark.timeout(120)


@pytest.mark.skip_debug()
async def test_create_snapshot(async_sandbox: AsyncSandbox):
    snapshot = await async_sandbox.create_snapshot()

    assert snapshot.snapshot_id
    assert len(snapshot.snapshot_id) > 0

    await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_create_sandbox_from_snapshot(async_sandbox: AsyncSandbox):
    test_content = "content from original sandbox"
    await async_sandbox.files.write("/home/user/test.txt", test_content)

    snapshot = await async_sandbox.create_snapshot()

    try:
        new_sandbox = await AsyncSandbox.create(snapshot.snapshot_id)

        try:
            content = await new_sandbox.files.read("/home/user/test.txt")
            assert content == test_content
        finally:
            await new_sandbox.kill()
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_create_multiple_sandboxes_from_snapshot(async_sandbox: AsyncSandbox):
    test_content = "shared snapshot content"
    await async_sandbox.files.write("/home/user/shared.txt", test_content)

    snapshot = await async_sandbox.create_snapshot()

    try:
        sandbox1 = await AsyncSandbox.create(snapshot.snapshot_id)
        sandbox2 = await AsyncSandbox.create(snapshot.snapshot_id)

        try:
            content1 = await sandbox1.files.read("/home/user/shared.txt")
            content2 = await sandbox2.files.read("/home/user/shared.txt")

            assert content1 == test_content
            assert content2 == test_content

            await sandbox1.files.write("/home/user/shared.txt", "modified in sandbox1")

            modified_content = await sandbox1.files.read("/home/user/shared.txt")
            unchanged_content = await sandbox2.files.read("/home/user/shared.txt")

            assert modified_content == "modified in sandbox1"
            assert unchanged_content == test_content
        finally:
            await sandbox1.kill()
            await sandbox2.kill()
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_list_snapshots(async_sandbox: AsyncSandbox):
    snapshot = await async_sandbox.create_snapshot()

    try:
        paginator = AsyncSandbox.list_snapshots()
        assert paginator.has_next

        snapshots = await paginator.next_items()
        assert isinstance(snapshots, list)

        found = any(s.snapshot_id == snapshot.snapshot_id for s in snapshots)
        assert found
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_list_snapshots_for_sandbox(async_sandbox: AsyncSandbox):
    snapshot = await async_sandbox.create_snapshot()

    try:
        paginator = AsyncSandbox.list_snapshots(
            sandbox_id=async_sandbox.sandbox_id,
        )
        snapshots = await paginator.next_items()

        found = any(s.snapshot_id == snapshot.snapshot_id for s in snapshots)
        assert found
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_list_snapshots_filtered_by_name(
    async_sandbox: AsyncSandbox, sandbox_test_id: str
):
    snapshot_name = f"snap-filter-{sandbox_test_id}"

    snapshot = await async_sandbox.create_snapshot(name=snapshot_name)

    try:
        paginator = AsyncSandbox.list_snapshots(name=snapshot_name)
        snapshots = await paginator.next_items()

        found = any(s.snapshot_id == snapshot.snapshot_id for s in snapshots)
        assert found

        empty_paginator = AsyncSandbox.list_snapshots(
            name=f"{snapshot_name}-does-not-exist"
        )
        empty_snapshots = await empty_paginator.next_items()
        assert isinstance(empty_snapshots, list)
        assert len(empty_snapshots) == 0
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_create_named_snapshot(async_sandbox: AsyncSandbox, sandbox_test_id: str):
    snapshot_name = f"snap-{sandbox_test_id}"

    snapshot = await async_sandbox.create_snapshot(name=snapshot_name)

    try:
        assert snapshot.snapshot_id
        assert isinstance(snapshot.names, list)
        assert len(snapshot.names) > 0
        assert any(snapshot_name in n for n in snapshot.names)
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_delete_snapshot(async_sandbox: AsyncSandbox):
    snapshot = await async_sandbox.create_snapshot()

    deleted = await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)
    assert deleted is True

    deleted_again = await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)
    assert deleted_again is False


@pytest.mark.skip_debug()
@pytest.mark.timeout(180)
async def test_snapshot_preserves_filesystem(async_sandbox: AsyncSandbox):
    app_dir = "/home/user/app"
    config_path = f"{app_dir}/config.json"
    config_content = '{"env": "test"}'
    data_path = f"{app_dir}/data.txt"
    data_content = "important data"

    await async_sandbox.files.make_dir(app_dir)
    await async_sandbox.files.write(config_path, config_content)
    await async_sandbox.files.write(data_path, data_content)

    snapshot = await async_sandbox.create_snapshot()

    try:
        try:
            new_sandbox = await AsyncSandbox.create(snapshot.snapshot_id)
        except SandboxException as error:
            # Placement can transiently time out while the snapshot is restored.
            # Retry only the backend response that explicitly asks the caller to do so.
            if "Failed to place sandbox: placement timed out" not in str(error):
                raise
            new_sandbox = await AsyncSandbox.create(snapshot.snapshot_id)

        try:
            dir_exists = await new_sandbox.files.exists(app_dir)
            assert dir_exists

            config = await new_sandbox.files.read(config_path)
            data = await new_sandbox.files.read(data_path)

            assert config == config_content
            assert data == data_content
        finally:
            await new_sandbox.kill()
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
async def test_create_snapshot_class_method(async_sandbox: AsyncSandbox):
    snapshot = await AsyncSandbox.create_snapshot(async_sandbox.sandbox_id)

    assert snapshot.snapshot_id
    assert len(snapshot.snapshot_id) > 0

    await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)


async def _boot_id(sandbox: AsyncSandbox) -> str:
    # Kernel boot id: it changes only across a real (cold) boot. Read via a
    # command, not files.read: envd serves procfs files as an empty 200
    # because it sizes them by stat.
    result = await sandbox.commands.run("cat /proc/sys/kernel/random/boot_id")
    return result.stdout.strip()


@pytest.mark.skip_debug()
async def test_create_filesystem_only_snapshot(async_sandbox: AsyncSandbox):
    test_content = "filesystem-only snapshot content"
    await async_sandbox.files.write("/home/user/fs-only.txt", test_content)
    source_boot = await _boot_id(async_sandbox)
    assert source_boot

    try:
        snapshot = await async_sandbox.create_snapshot(mode="filesystem")
    except SandboxException as error:
        # The API answers 400 while filesystem-only snapshots are not enabled
        # for the team; there is nothing to prove in that environment.
        if error.status_code == 400 and "not enabled for this team" in str(error):
            pytest.skip("filesystem-only snapshots are not enabled for this team")
        raise
    assert snapshot.snapshot_id

    try:
        # The source sandbox keeps running and was not rebooted.
        assert await async_sandbox.is_running()
        assert await async_sandbox.files.read("/home/user/fs-only.txt") == test_content
        assert await _boot_id(async_sandbox) == source_boot

        # A sandbox created from it has the files and a fresh boot id: it
        # cold-booted instead of restoring memory. A memory snapshot would
        # carry the source's boot id over, so this is what tells them apart.
        new_sandbox = await AsyncSandbox.create(snapshot.snapshot_id)
        try:
            assert (
                await new_sandbox.files.read("/home/user/fs-only.txt") == test_content
            )
            new_boot = await _boot_id(new_sandbox)
            assert new_boot
            assert new_boot != source_boot
        finally:
            await new_sandbox.kill()
    finally:
        await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)
