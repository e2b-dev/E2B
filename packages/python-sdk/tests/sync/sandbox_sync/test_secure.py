import pytest

from e2b import Sandbox


@pytest.mark.skip_debug()
def test_start_secured(template):
    sbx = Sandbox.create(template, timeout=5, secure=True)
    try:
        assert sbx.is_running()
        assert sbx._envd_version is not None
        assert sbx._envd_access_token is not None
    finally:
        sbx.kill()


@pytest.mark.skip_debug()
def test_connect_to_secured(template):
    sbx = Sandbox.create(template, timeout=5, secure=True)
    try:
        assert sbx.is_running()
        assert sbx._envd_version is not None
        assert sbx._envd_access_token is not None

        sbx_connection = Sandbox.connect(sbx.sandbox_id)
        assert sbx_connection.is_running()
        assert sbx_connection._envd_version is not None
        assert sbx_connection._envd_access_token is not None
    finally:
        sbx.kill()
