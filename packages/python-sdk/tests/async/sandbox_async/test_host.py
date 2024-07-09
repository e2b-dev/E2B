import httpx
import pytest

from time import sleep

from e2b import AsyncSandbox


@pytest.mark.anyio
async def test_ping_server(async_sandbox: AsyncSandbox, debug):
    cmd = await async_sandbox.commands.run(
        "python -m http.server 8000",
        background=True,
    )

    try:
        sleep(1)
        host = async_sandbox.get_host(8000)

        async with httpx.AsyncClient() as client:
            res = await client.get(f"{'http' if debug else 'https'}://{host}")
            assert res.status_code == 200

    finally:
        await cmd.kill()
