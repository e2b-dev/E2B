from e2b import Sandbox


def test_create_sandbox():
    sandbox = Sandbox()
    sandbox.close()


def test_create_multiple_sandboxes():
    sandbox = Sandbox()
    sandbox2 = Sandbox()
    sandbox.close()
    sandbox2.close()
