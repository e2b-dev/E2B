from e2b import Session


async def test_env_vars():
    session = await Session.create("Bash")

    process = await session.process.start("echo $FOO", env_vars={"FOO": "BAR"})
    await process
    output = process.stdout
    assert output == "BAR"

    await session.close()


async def test_profile_env_vars():
    session = await Session.create("Bash")

    await session.filesystem.write("/home/user/.profile", "export FOO=BAR")
    process = await session.process.start("echo $FOO")
    await process
    output = process.stdout
    assert output == "BAR"

    await session.close()


async def test_default_env_vars():
    session = await Session.create("Bash", env_vars={"FOO": "BAR"})
    process = await session.process.start("echo $FOO")
    await process
    output = process.stdout
    assert output == "BAR"

    await session.close()


async def test_overriding_env_vars():
    session = await Session.create("Bash", env_vars={"FOO": "BAR"})

    process = await session.process.start("echo $FOO", env_vars={"FOO": "QUX"})
    await process
    output = process.stdout
    assert output == "QUX"

    await session.close()
