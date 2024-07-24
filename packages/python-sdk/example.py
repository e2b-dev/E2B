import asyncio
import time
import logging
from e2b import AsyncSandbox, Sandbox

import dotenv

dotenv.load_dotenv()

logging.basicConfig(level=logging.ERROR)


async def main():
    sbx = await AsyncSandbox.create(timeout=10)
    await sbx.commands.run("sleep 10", timeout=1000)
    # for _ in range(10):
    #     start = time.time()
    #     end = time.time()
    #     print(f"Time taken: {end - start}")


if __name__ == "__main__":
    asyncio.run(main())
