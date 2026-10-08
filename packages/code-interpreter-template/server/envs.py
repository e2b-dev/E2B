import os
from typing import Optional

import httpx

LOCAL = os.getenv("E2B_LOCAL", False)
ENVD_PORT = 49983


async def get_envs(access_token: Optional[str]) -> dict:
    if LOCAL:
        return {"E2B_TEST_VARIABLE": "true"}
    async with httpx.AsyncClient() as client:
        headers = {}
        if access_token:
            headers["X-Access-Token"] = f"{access_token}"
        response = await client.get(
            f"http://localhost:{ENVD_PORT}/envs", headers=headers
        )
        return response.json()
