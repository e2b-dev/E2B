import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # Timeout for the process to start
  npm_init = await session.process.start("npm init -y", timeout=5) # $HighlightLine
  await npm_init

  await session.close()

asyncio.run(main())
