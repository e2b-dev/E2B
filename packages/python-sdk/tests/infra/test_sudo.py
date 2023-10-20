from e2b import Session


def test_sudo():
    session = Session("Bash")

    process = session.process.start("sudo echo test")
    process.wait()
    output = process.stdout
    assert output == "test"
    session.close()
