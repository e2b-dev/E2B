import asyncio
from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")
  await session.close()

asyncio.new_event_loop().run_until_complete(main())