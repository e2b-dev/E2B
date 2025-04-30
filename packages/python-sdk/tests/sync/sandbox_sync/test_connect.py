import uuid

from e2b import Sandbox


def test_connect(template):
    sbx = Sandbox(template, timeout=10)
    try:
        assert sbx.is_running()

        sbx_connection = Sandbox.connect(sbx.sandbox_id)
        assert sbx_connection.is_running()
    finally:
        sbx.kill()

def test_connect_with_secure(template):
    dir_name = f"test_directory_{uuid.uuid4()}"

    sbx = Sandbox(template, timeout=10, secrue=True)
    try:
        assert sbx.is_running()

        sbx_connection = Sandbox.connect(sbx.sandbox_id)

        sbx_connection.files.make_dir(dir_name)
        files = sbx_connection.files.list(dir_name)
        assert len(files) == 0

    finally:
        sbx.kill()
