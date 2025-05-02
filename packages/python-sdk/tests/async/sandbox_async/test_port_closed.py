import pytest
import asyncio
import json
import httpx
from e2b import AsyncSandbox


async def test_port_closed(template, helpers):
    sbx = await AsyncSandbox.create(template, timeout=60)
    try:
        assert await sbx.is_running()

        good_port = 8002
        # Start a Python HTTP server on port 8002
        cmd = await sbx.commands.run(
            f"python -m http.server {good_port}",
            background=True,
        )

        disable = helpers.wait_for_async_cmd_exit_error_in_background(cmd)

        await asyncio.sleep(1)  # Wait for server to start

        # Test good port (8002)
        good_host = sbx.get_host(good_port)
        async with httpx.AsyncClient() as client:
            for _ in range(20):
                try:
                    response = await client.get(f"https://{good_host}")
                    if response.status_code == 200:
                        break
                except httpx.RequestError:
                    pass
                await asyncio.sleep(0.5)
            assert response.status_code == 200

        # Test bad port (3000)
        bad_port = 3000
        bad_host = sbx.get_host(bad_port)
        async with httpx.AsyncClient() as client:
            for _ in range(20):
                try:
                    response = await client.get(f"https://{bad_host}")
                    if response.status_code == 502:
                        break
                except httpx.RequestError:
                    pass
                await asyncio.sleep(0.5)
            assert response.status_code == 502
            resp_text = response.text
            resp = json.loads(resp_text)
            cleaned_sbx_id = sbx.sandbox_id.split("-")[0]
            assert resp["message"] == "The sandbox is running but port is not open"
            assert cleaned_sbx_id == resp["sandboxId"]
            assert resp["port"] == bad_port
        disable()
    finally:
        await sbx.kill()
