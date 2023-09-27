import asyncio

import pytest

from e2b import Session


async def test_create_session_timeout():
    with pytest.raises(asyncio.TimeoutError):
        await Session.create("Nodejs", timeout=0.01)


async def test_process_timeout():
    with pytest.raises(asyncio.TimeoutError):
        session = await Session.create("Nodejs")
        await session.process.start(
            "sleep 1",
            timeout=0.01,
        )
    await session.close()


async def test_filesystem_timeout():
    with pytest.raises(asyncio.TimeoutError):
        session = await Session.create("Nodejs")
        await session.filesystem.write(
            "test.txt",
            "Hello World",
            timeout=0.01,
        )
    await session.close()
