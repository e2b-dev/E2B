import pytest

from e2b import Session


def test_process_cwd():
    session = Session("Nodejs", cwd="/code/app")

    proc = session.process.start("pwd")
    output = proc.wait()
    assert output.stdout == "/code/app"
    session.close()


def test_filesystem_cwd():
    session = Session("Nodejs", cwd="/code/app")

    session.filesystem.write("hello.txt", "Hello VM!")
    proc = session.process.start("cat /code/app/hello.txt")
    output = proc.wait()
    assert output.stdout == "Hello VM!"

    session.close()


async def test_change_cwd():
    session = Session("Nodejs", cwd="/code/app")

    # change dir to /home/user
    session.cwd = "/home/user"

    # process respects cwd
    proc = session.process.start("pwd")
    output = proc.wait()
    assert output.stdout == "/home/user"

    # filesystem respects cwd
    session.filesystem.write("hello.txt", "Hello VM!")
    proc = session.process.start("cat /home/user/hello.txt")
    output = proc.wait()
    assert output.stdout == "Hello VM!"

    session.close()


async def test_initial_cwd_with_tilde():
    session = Session("Nodejs", cwd="~/code/")

    proc = session.process.start("pwd")
    output = proc.wait()
    assert output.stdout == "/home/user/code"

    session.close()


async def test_relative_paths():
    session = Session("Nodejs", cwd="/home/user")

    session.filesystem.make_dir("./code")
    session.filesystem.write("./code/hello.txt", "Hello Vasek!")
    proc = session.process.start("cat /home/user/code/hello.txt")
    output = proc.wait()
    assert output.stdout == "Hello Vasek!"

    session.filesystem.write("../../hello.txt", "Hello Tom!")
    proc = session.process.start("cat /hello.txt")
    output = proc.wait()
    assert output.stdout == "Hello Tom!"

    session.close()


async def test_warnings():
    session = Session("Nodejs")

    with pytest.warns(Warning):
        session.filesystem.write("./hello.txt", "Hello Vasek!")

    with pytest.warns(Warning):
        session.filesystem.write("../hello.txt", "Hello Vasek!")

    with pytest.warns(Warning):
        session.filesystem.write("~/hello.txt", "Hello Vasek!")

    session.close()
