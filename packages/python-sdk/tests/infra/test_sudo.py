from e2b import Sandbox


def test_sudo():
    sandbox = Sandbox()

    process = sandbox.process.start("sudo echo test")
    process.wait()
    output = process.stdout
    assert output == "test"
    sandbox.close()
