import asyncio
from os import getenv

import pytest
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


async def test_create_session_timeout():
    with pytest.raises(asyncio.TimeoutError):
        await Session.create("Nodejs", api_key=E2B_API_KEY, timeout=0.1)


async def test_process_timeout():
    with pytest.raises(asyncio.TimeoutError):
        session = await Session.create("Nodejs", api_key=E2B_API_KEY)
        await session.process.start(
            "sleep 1",
            timeout=0.1,
        )
    await session.close()


async def test_filesystem_timeout():
    with pytest.raises(asyncio.TimeoutError):
        session = await Session.create("Nodejs", api_key=E2B_API_KEY)
        await session.filesystem.write(
            "test.txt",
            "Hello World",
            timeout=0.1,
        )
    await session.close()
