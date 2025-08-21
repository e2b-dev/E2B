import asyncio
import logging
from e2b import AsyncSandbox

import dotenv

dotenv.load_dotenv()

logging.basicConfig(level=logging.ERROR)


async def main():
    sbx = await AsyncSandbox.create(timeout=10)
    await sbx.set_timeout(20)


if __name__ == "__main__":
    asyncio.run(main())
