import asyncio
from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")

  # Read file
  file_content = await session.filesystem.read('/etc/hosts')
  print(file_content)

  await session.close()

asyncio.new_event_loop().run_until_complete(main())