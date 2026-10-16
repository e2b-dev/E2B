import pytest_asyncio

from e2b import AsyncSandbox


@pytest_asyncio.fixture
async def async_sandbox():
    sandbox = await AsyncSandbox.create(timeout=300)
    try:
        yield sandbox
    finally:
        await sandbox.kill()
