import asyncio
from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")

  # Read the '/etc/hosts' file
  file_content = await session.filesystem.read('/etc/hosts')

  # Prints something like:
  # 127.0.0.1       localhost
  print(file_content)

  await session.close()

asyncio.new_event_loop().run_until_complete(main())