import asyncio
import logging
from e2b import AsyncSandbox

import dotenv

dotenv.load_dotenv()

logging.basicConfig(level=logging.ERROR)


async def main():
    sbx = await AsyncSandbox.beta_create(timeout=10, mcp={"duckduckgo": {}})
    await sbx.set_timeout(20)

    print(await sbx.beta_get_mcp_token())


if __name__ == "__main__":
    asyncio.run(main())
