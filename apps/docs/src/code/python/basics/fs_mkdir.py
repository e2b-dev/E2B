import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # `filesystem.make_dir()` will fail if any directory in the path doesn't exist

  # Create a new directory '/dir'
  await session.filesystem.make_dir("/dir")

  await session.close()

asyncio.run(main())