import pytest
from e2b import AsyncSandbox


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
async def test_delete_snapshot(async_sandbox: AsyncSandbox):
    snapshot = await async_sandbox.create_snapshot()

    deleted = await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)
    assert deleted is True

    deleted_again = await AsyncSandbox.delete_snapshot(snapshot.snapshot_id)
    assert deleted_again is False


@pytest.mark.skip_debug()
async def test_snapshot_preserves_filesystem(async_sandbox: AsyncSandbox):
    await async_sandbox.files.make_dir("/home/user/app")
    await async_sandbox.files.write("/home/user/app/config.json", '{"env": "test"}')
    await async_sandbox.files.write("/home/user/app/data.txt", "important data")

    snapshot = await async_sandbox.create_snapshot()

    try:
        new_sandbox = await AsyncSandbox.create(snapshot.snapshot_id)

        try:
            dir_exists = await new_sandbox.files.exists("/home/user/app")
            assert dir_exists

            config = await new_sandbox.files.read("/home/user/app/config.json")
            data = await new_sandbox.files.read("/home/user/app/data.txt")

            assert config == '{"env": "test"}'
            assert data == "important data"
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
