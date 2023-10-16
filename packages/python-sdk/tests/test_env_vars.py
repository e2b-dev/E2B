from e2b import Session


def test_env_vars():
    session = Session("Bash")

    process = session.process.start("echo $FOO", env_vars={"FOO": "BAR"})
    process.wait()
    output = process.stdout
    assert output == "BAR"

    session.close()


def test_profile_env_vars():
    session = Session("Bash")

    session.filesystem.write("/home/user/.profile", "export FOO=BAR")
    process = session.process.start("echo $FOO")
    process.wait()
    output = process.stdout
    assert output == "BAR"

    session.close()


def test_default_env_vars():
    session = Session("Bash", env_vars={"FOO": "BAR"})
    process = session.process.start("echo $FOO")
    process.wait()
    output = process.stdout
    assert output == "BAR"

    session.close()


def test_overriding_env_vars():
    session = Session("Bash", env_vars={"FOO": "BAR"})

    process = session.process.start("echo $FOO", env_vars={"FOO": "QUX"})
    process.wait()
    output = process.stdout
    assert output == "QUX"

    session.close()
