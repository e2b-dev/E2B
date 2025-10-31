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
