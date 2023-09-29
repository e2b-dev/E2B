import pytest

from e2b import Session


async def test_process_cwd():
    session = await Session.create("Nodejs", cwd="/code/app")

    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/code/app"
    await session.close()


async def test_filesystem_cwd():
    session = await Session.create("Nodejs", cwd="/code/app")

    await session.filesystem.write("hello.txt", "Hello VM!")
    proc = await session.process.start("cat /code/app/hello.txt")
    output = await proc
    assert output.stdout == "Hello VM!"

    await session.close()


async def test_change_cwd():
    session = await Session.create("Nodejs", cwd="/code/app")

    # change dir to /home/user
    session.cwd = "/home/user"

    # process respects cwd
    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/home/user"

    # filesystem respects cwd
    await session.filesystem.write("hello.txt", "Hello VM!")
    proc = await session.process.start("cat /home/user/hello.txt")
    output = await proc
    assert output.stdout == "Hello VM!"

    await session.close()


async def test_initial_cwd_with_tilde():
    session = await Session.create("Nodejs", cwd="~/code/")

    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/home/user/code"

    await session.close()


async def test_relative_paths():
    session = await Session.create("Nodejs", cwd="/home/user")

    await session.filesystem.make_dir("./code")
    await session.filesystem.write("./code/hello.txt", "Hello Vasek!")
    proc = await session.process.start("cat /home/user/code/hello.txt")
    output = await proc
    assert output.stdout == "Hello Vasek!"

    await session.filesystem.write("../../hello.txt", "Hello Tom!")
    proc = await session.process.start("cat /hello.txt")
    output = await proc
    assert output.stdout == "Hello Tom!"

    await session.close()


async def test_warnings():
    session = await Session.create("Nodejs")

    with pytest.warns(Warning):
        await session.filesystem.write("./hello.txt", "Hello Vasek!")

    with pytest.warns(Warning):
        await session.filesystem.write("../hello.txt", "Hello Vasek!")

    with pytest.warns(Warning):
        await session.filesystem.write("~/hello.txt", "Hello Vasek!")

    await session.close()
