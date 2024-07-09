import asyncio
import time
import logging
from e2b import AsyncSandbox, Sandbox

import dotenv

dotenv.load_dotenv()

logging.basicConfig(level=logging.ERROR)


async def main():
    for _ in range(10):
        start = time.time()
        sbx = await AsyncSandbox.create(timeout=10)
        end = time.time()
        print(f"Time taken: {end - start}")


if __name__ == "__main__":
    asyncio.run(main())
