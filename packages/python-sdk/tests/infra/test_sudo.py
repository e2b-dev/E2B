from e2b import Session


async def test_sudo():
    session = await Session.create("Nodejs")

    process = await session.process.start("sudo echo test")
    await process
    output = process.stdout
    assert output == "/home/user"
    await session.close()
