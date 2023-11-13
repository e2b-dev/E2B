from e2b import Sandbox


def test_register_action():
    sandbox = Sandbox()

    sandbox.register_action("test", lambda sbx, args: "test")
    assert len(sandbox.actions.values()) == 1

    sandbox.close()
