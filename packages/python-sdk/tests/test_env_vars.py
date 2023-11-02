from e2b import Sandbox


def test_env_vars():
    sandbox = Sandbox()

    process = sandbox.process.start("echo $FOO", env_vars={"FOO": "BAR"})
    process.wait()
    output = process.stdout
    assert output == "BAR"

    sandbox.close()


def test_profile_env_vars():
    sandbox = Sandbox()

    sandbox.filesystem.write("/home/user/.profile", "export FOO=BAR")
    process = sandbox.process.start("echo $FOO")
    process.wait()
    output = process.stdout
    assert output == "BAR"

    sandbox.close()


def test_default_env_vars():
    sandbox = Sandbox(env_vars={"FOO": "BAR"})
    process = sandbox.process.start("echo $FOO")
    process.wait()
    output = process.stdout
    assert output == "BAR"

    sandbox.close()


def test_overriding_env_vars():
    sandbox = Sandbox(env_vars={"FOO": "BAR"})

    process = sandbox.process.start("echo $FOO", env_vars={"FOO": "QUX"})
    process.wait()
    output = process.stdout
    assert output == "QUX"

    sandbox.close()
