from e2b.sandbox.main import Sandbox


def test_start(template):
    sbx = Sandbox(template, timeout=5)
    assert sbx.is_running()
