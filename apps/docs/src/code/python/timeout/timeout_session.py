import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  # Timeout for the session to open
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY, timeout=5) # $HighlightLine

  await session.close()

asyncio.run(main())
