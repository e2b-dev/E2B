import pytest
from e2b import Sandbox


@pytest.mark.skip_debug()
def test_create_snapshot(sandbox: Sandbox):
    snapshot = sandbox.create_snapshot()

    assert snapshot.snapshot_id
    assert len(snapshot.snapshot_id) > 0

    Sandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
def test_create_sandbox_from_snapshot(sandbox: Sandbox):
    test_content = "content from original sandbox"
    sandbox.files.write("/home/user/test.txt", test_content)

    snapshot = sandbox.create_snapshot()

    try:
        new_sandbox = Sandbox.create(snapshot.snapshot_id)

        try:
            content = new_sandbox.files.read("/home/user/test.txt")
            assert content == test_content
        finally:
            new_sandbox.kill()
    finally:
        Sandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
def test_create_multiple_sandboxes_from_snapshot(sandbox: Sandbox):
    test_content = "shared snapshot content"
    sandbox.files.write("/home/user/shared.txt", test_content)

    snapshot = sandbox.create_snapshot()

    try:
        sandbox1 = Sandbox.create(snapshot.snapshot_id)
        sandbox2 = Sandbox.create(snapshot.snapshot_id)

        try:
            content1 = sandbox1.files.read("/home/user/shared.txt")
            content2 = sandbox2.files.read("/home/user/shared.txt")

            assert content1 == test_content
            assert content2 == test_content

            sandbox1.files.write("/home/user/shared.txt", "modified in sandbox1")

            modified_content = sandbox1.files.read("/home/user/shared.txt")
            unchanged_content = sandbox2.files.read("/home/user/shared.txt")

            assert modified_content == "modified in sandbox1"
            assert unchanged_content == test_content
        finally:
            sandbox1.kill()
            sandbox2.kill()
    finally:
        Sandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
def test_list_snapshots(sandbox: Sandbox):
    snapshot = sandbox.create_snapshot()

    try:
        paginator = Sandbox.list_snapshots()
        assert paginator.has_next

        snapshots = paginator.next_items()
        assert isinstance(snapshots, list)

        found = any(s.snapshot_id == snapshot.snapshot_id for s in snapshots)
        assert found
    finally:
        Sandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
def test_list_snapshots_for_sandbox(sandbox: Sandbox):
    snapshot = sandbox.create_snapshot()

    try:
        paginator = Sandbox.list_snapshots(sandbox_id=sandbox.sandbox_id)
        snapshots = paginator.next_items()

        found = any(s.snapshot_id == snapshot.snapshot_id for s in snapshots)
        assert found
    finally:
        Sandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
def test_delete_snapshot(sandbox: Sandbox):
    snapshot = sandbox.create_snapshot()

    deleted = Sandbox.delete_snapshot(snapshot.snapshot_id)
    assert deleted is True

    deleted_again = Sandbox.delete_snapshot(snapshot.snapshot_id)
    assert deleted_again is False


@pytest.mark.skip_debug()
def test_snapshot_preserves_filesystem(sandbox: Sandbox):
    sandbox.files.make_dir("/home/user/app")
    sandbox.files.write("/home/user/app/config.json", '{"env": "test"}')
    sandbox.files.write("/home/user/app/data.txt", "important data")

    snapshot = sandbox.create_snapshot()

    try:
        new_sandbox = Sandbox.create(snapshot.snapshot_id)

        try:
            dir_exists = new_sandbox.files.exists("/home/user/app")
            assert dir_exists

            config = new_sandbox.files.read("/home/user/app/config.json")
            data = new_sandbox.files.read("/home/user/app/data.txt")

            assert config == '{"env": "test"}'
            assert data == "important data"
        finally:
            new_sandbox.kill()
    finally:
        Sandbox.delete_snapshot(snapshot.snapshot_id)


@pytest.mark.skip_debug()
def test_create_snapshot_class_method(sandbox: Sandbox):
    snapshot = Sandbox.create_snapshot(sandbox.sandbox_id)

    assert snapshot.snapshot_id
    assert len(snapshot.snapshot_id) > 0

    Sandbox.delete_snapshot(snapshot.snapshot_id)
