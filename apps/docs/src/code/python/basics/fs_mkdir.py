import asyncio
from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")

  # `filesystem.make_dir()` will fail if any directory in the path doesn't exist

  # Create a new directory '/dir'
  await session.filesystem.make_dir("/dir")

  await session.close()

asyncio.new_event_loop().run_until_complete(main())