import pytest

from e2b import Sandbox


def test_start_secured(template):
    sbx = Sandbox(template, timeout=5, secrue=True)
    try:
        assert sbx.is_running()
        assert sbx._envd_version is not None
        assert sbx._envd_access_token is not None
    finally:
        sbx.kill()
