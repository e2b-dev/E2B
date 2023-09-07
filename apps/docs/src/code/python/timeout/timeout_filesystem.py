import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # Timeout for the write operation
  await session.filesystem.write("test.txt", "Hello World", timeout=3)

  # Timeout for the list operation
  await session.filesystem.list(".", timeout=3)

  # Timeout for the read operation
  await session.filesystem.read("test.txt", timeout=3)

  await session.close()

asyncio.run(main())