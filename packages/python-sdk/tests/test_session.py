from e2b import Sandbox


def test_create_sandbox():
    sandbox = Sandbox("Bash")
    sandbox.close()


def test_create_multiple_sandboxes():
    sandbox = Sandbox("Bash")
    sandbox2 = Sandbox("Bash")
    sandbox.close()
    sandbox2.close()
