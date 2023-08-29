import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

watcher = None
async def create_watcher(session):
  watcher = await session.filesystem.watch_dir("/home")
  watcher.add_event_listener(lambda event: print(event))
  await watcher.start()

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  await create_watcher(session)

  for i in range(10):
    await session.filesystem.write(f"/home/file{i}.txt", f"Hello World {i}!")
    await asyncio.sleep(1)

  await session.close()

asyncio.new_event_loop().run_until_complete(main())