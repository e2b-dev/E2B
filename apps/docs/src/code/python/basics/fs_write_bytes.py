import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  content_in_bytes = bytearray(b"Hello world")

  # `write_bytes` will write bytearray to a file inside the playground.
  await session.filesystem.write_bytes('/file', content_in_bytes) # $HighlightLine

  # We can read the file back to verify the content
  file_content = await session.filesystem.read('/file')
  print(file_content)

  await session.close()

asyncio.run(main())
