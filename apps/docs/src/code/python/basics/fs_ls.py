import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # List the root directory
  content = await session.filesystem.list("/") # $HighlightLine
  for item in content:
    print(item.name, "Is directory?", item.is_dir)

  await session.close()

asyncio.run(main())
