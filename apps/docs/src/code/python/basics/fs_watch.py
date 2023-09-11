import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

watcher = None
async def create_watcher(session): # $HighlightLine
  # Start filesystem watcher for the /home directory # $HighlightLine
  watcher = await session.filesystem.watch_dir("/home") # $HighlightLine
  watcher.add_event_listener(lambda event: print(event)) # $HighlightLine
  await watcher.start() # $HighlightLine

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  await create_watcher(session) # $HighlightLine

  # Create files in the /home directory inside the playground
  # We'll receive notifications for these events through the watcher we created above.
  for i in range(10):
    # `filesystem.write()` will trigger two events:
    # 1. 'Create' when the file is created
    # 2. 'Write' when the file is written to
    await session.filesystem.write(f"/home/file{i}.txt", f"Hello World {i}!")
    await asyncio.sleep(1)

  await session.close()

asyncio.run(main())
