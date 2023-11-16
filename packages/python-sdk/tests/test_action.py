from e2b import Sandbox


def test_add_action():
    sandbox = Sandbox()

    sandbox.add_action(name="test", action=lambda sbx, args: "test")
    assert len(sandbox.actions.values()) == 1

    sandbox.remove_action(name="test")
    assert len(sandbox.actions.values()) == 0

    sandbox.close()
