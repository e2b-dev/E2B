from e2b import Session


async def test_process_cwd():
    session = await Session.create("Nodejs", cwd="/code/app")

    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/code/app"
    await session.close()


async def test_filesystem_cwd():
    session = await Session.create("Nodejs", cwd="/code/app")

    # filesystem ops does not respect the cwd yet
    await session.filesystem.write("hello.txt", "Hello VM!")
    proc = await session.process.start(
        "cat /code/app/hello.txt"
    )  # notice the file is in root
    output = await proc
    assert output.stdout == "Hello VM!"


async def test_cd():
    session = await Session.create("Nodejs", cwd="/code/app")

    # change dir to /home/user
    session.cd("/home/user")

    # process respects cd
    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/home/user"

    # filesystem respects cd
    await session.filesystem.write("hello.txt", "Hello VM!")
    proc = await session.process.start("cat /home/user/hello.txt")
    output = await proc
    assert output.stdout == "Hello VM!"


async def test_initial_cwd_with_tilde():
    session = await Session.create("Nodejs", cwd="~/code/")

    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/home/user/code"


async def test_relative_paths():
    session = await Session.create("Nodejs", cwd="/home/")

    await session.filesystem.write("./user/hello.txt", "Hello Vasek!")
    proc = await session.process.start("cat /home/user/hello.txt")
    output = await proc
    assert output.stdout == "Hello Vasek!"

    await session.filesystem.write("../hello.txt", "Hello Tom!")
    proc = await session.process.start("cat /hello.txt")
    output = await proc
    assert output.stdout == "Hello Tom!"
