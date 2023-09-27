from e2b import Session


async def test_homedir():
    session = await Session.create("Bash")

    process = await session.process.start("echo $HOME")
    await process
    output = process.stdout
    assert output == "/home/user"
    await session.close()
