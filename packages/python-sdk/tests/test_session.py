from os import getenv

from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


async def test_create_session():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)
    await session.close()


async def test_create_multiple_sessions():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY)
    session2 = await Session.create("Nodejs", api_key=E2B_API_KEY)
    await session.close()
    await session2.close()


async def test_custom_cwd():
    session = await Session.create("Nodejs", api_key=E2B_API_KEY, cwd="/code/app")

    proc = await session.process.start("pwd")
    output = await proc
    assert output.stdout == "/code/app"
    
    # TODO: test process start
