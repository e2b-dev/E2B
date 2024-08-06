import asyncio
import time
import logging
from e2b import AsyncSandbox, Sandbox

import dotenv

dotenv.load_dotenv()

logging.basicConfig(level=logging.ERROR)


async def main():
    sbx = await AsyncSandbox.create(timeout=10, debug=True)
    await sbx.files.make_dir("test")
    with open("Makefile", "rb") as f, open("Makefile", "rb") as f2:
        await sbx.files.write("/home/user/test/a.txt", f, f2)
    print(await sbx.files.list("test"))
    print(await sbx.files.list("/home/user/test"))
    # for _ in range(10):
    #     start = time.time()
    #     end = time.time()
    #     print(f"Time taken: {end - start}")


if __name__ == "__main__":
    asyncio.run(main())
