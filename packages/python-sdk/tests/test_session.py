from e2b import Session


async def test_create_session():
    session = await Session.create("Nodejs")
    await session.close()


async def test_create_multiple_sessions():
    session = await Session.create("Nodejs")
    session2 = await Session.create("Nodejs")
    await session.close()
    await session2.close()


async def test_custom_cwd():
    session = await Session.create("Nodejs", cwd="/code/app")

    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/code/app"

    # filesystem ops does not respect the cwd yet
    await session.filesystem.write("hello.txt", "Hello VM!")
    proc = await session.process.start("cat /hello.txt")  # notice the file is in root
    output = await proc
    assert output.stdout == "Hello VM!"

    # change dir to /home/user
    proc = await session.process.start("cd /home/user")
    await proc

    # create another file, it should still be in root
    await session.filesystem.write("hello2.txt", "Hello VM 2!")
    proc = await session.process.start("cat /hello2.txt")
    output = await proc
    assert output.stdout == "Hello VM 2!"
