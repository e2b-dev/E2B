from e2b import Sandbox


def test_connect(template):
    sbx = Sandbox(template, timeout=10)
    assert sbx.is_running()

    sbx_connection = Sandbox.connect(sbx.sandbox_id)
    assert sbx_connection.is_running()
