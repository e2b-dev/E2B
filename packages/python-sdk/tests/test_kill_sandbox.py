from e2b import Sandbox


def test_kill_sandbox():
    s = Sandbox()
    Sandbox.kill(s.id)

    sandboxes = Sandbox.list()
    assert s.id not in [sandbox.sandbox_id for sandbox in sandboxes]

    s.close()
