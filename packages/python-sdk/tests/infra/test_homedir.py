from e2b import Session


def test_homedir():
    session = Session.create("Bash")

    process = session.process.start("echo $HOME")
    process.wait()
    output = process.stdout
    assert output == "/home/user"
    session.close()
