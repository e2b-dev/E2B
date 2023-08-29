import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # `filesystem.writre()` will:
  # - create the file if it doesn't exist
  # - fail if any directory in the path doesn't exist
  # - overwrite the file if it exists

  # Write the content of the file '/hello.txt'
  await session.filesystem.write("/hello.txt", "Hello World!")

  # The following would fail because '/dir' doesn't exist
  # await session.filesystem.write("/dir/hello.txt", "Hello World!")

  await session.close()

asyncio.run(main())