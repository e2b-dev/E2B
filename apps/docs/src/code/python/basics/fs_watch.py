import asyncio
from e2b import Session

watcher = None
async def create_watcher(session):
  watcher = await session.filesystem.watch_dir("/home")
  watcher.add_event_listener(lambda event: print(event))

async def main():
  session = await Session.create(id="Nodejs")

  create_watcher(session)

  for i in range(10):
    await session.filesystem.write(f"/home/file{i}.txt", f"Hello World {i}!")
    await asyncio.sleep(1)


  await session.close()

asyncio.new_event_loop().run_until_complete(main())