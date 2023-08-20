import asyncio
from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")

  # List directory
  dir_content = await session.filesystem.list('/')
  for item in dir_content:
    print(item)

  await session.close()

asyncio.new_event_loop().run_until_complete(main())