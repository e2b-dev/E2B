import uuid
import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_connect(sandbox_factory):
    sbx = sandbox_factory(timeout=10)

    assert sbx.is_running()

    sbx_connection = Sandbox.connect(sbx.sandbox_id)
    assert sbx_connection.is_running()


@pytest.mark.skip_debug()
def test_connect_with_secure(sandbox_factory):
    dir_name = f"test_directory_{uuid.uuid4()}"

    sbx = sandbox_factory(timeout=10, secure=True)

    assert sbx.is_running()

    sbx_connection = Sandbox.connect(sbx.sandbox_id)

    sbx_connection.files.make_dir(dir_name)
    files = sbx_connection.files.list(dir_name)
    assert len(files) == 0


@pytest.mark.skip_debug()
def test_connect_does_not_shorten_timeout_on_running_sandbox(template):
    # Create sandbox with a 300 second timeout
    sbx = Sandbox.create(template, timeout=300)
    try:
        assert sbx.is_running()

        # Get initial info to check end_at
        info_before = Sandbox.get_info(sbx.sandbox_id)

        # Connect with a shorter timeout (10 seconds)
        Sandbox.connect(sbx.sandbox_id, timeout=10)

        # Get info after connection
        info_after = Sandbox.get_info(sbx.sandbox_id)

        # The end_at time should not have been shortened. It should be the same
        assert info_after.end_at == info_before.end_at, (
            f"Timeout was shortened: before={info_before.end_at}, after={info_after.end_at}"
        )
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_connect_extends_timeout_on_running_sandbox(sandbox):
    # Get initial info to check end_at
    info_before = sandbox.get_info()

    # Connect with a longer timeout
    Sandbox.connect(sandbox.sandbox_id, timeout=600)

    # Get info after connection
    info_after = sandbox.get_info()

    # The end_at time should have been extended
    assert info_after.end_at > info_before.end_at, (
        f"Timeout was not extended: before={info_before.end_at}, after={info_after.end_at}"
    )
