import httpx
import pytest

from time import sleep

from e2b import AsyncSandbox


@pytest.mark.asyncio
async def test_ping_server(async_sandbox: AsyncSandbox, debug):
    cmd = async_sandbox.commands.run("python -m http.server 8000", background=True)

    try:
        sleep(1)
        host = async_sandbox.get_host(8000)
        res = httpx.get(f"{'http' if debug else 'https'}://{host}")
        assert res.status_code == 200

    finally:
        cmd.kill()
