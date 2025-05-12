import asyncio

import httpx

from e2b import AsyncSandbox


async def test_ping_server(async_sandbox: AsyncSandbox, debug, helpers):
    cmd = await async_sandbox.commands.run(
        "python -m http.server 8000",
        background=True,
    )

    disable = helpers.catch_cmd_exit_error_in_background(cmd)

    try:
        host = async_sandbox.get_host(8000)

        status_code = None
        async with httpx.AsyncClient() as client:
            for _ in range(20):
                res = await client.get(f"{'http' if debug else 'https'}://{host}")
                status_code = res.status_code
                if res.status_code == 200:
                    break
                await asyncio.sleep(0.5)
        assert status_code == 200
        disable()
    finally:
        await cmd.kill()
