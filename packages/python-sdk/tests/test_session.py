from e2b import Session


async def test_create_session():
    session = await Session.create("Nodejs")
    await session.close()


async def test_create_multiple_sessions():
    session = await Session.create("Nodejs")
    session2 = await Session.create("Nodejs")
    await session.close()
    await session2.close()
