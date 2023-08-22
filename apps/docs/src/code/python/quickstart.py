import asyncio
from e2b import Session

async def main():
  # `id` can also be one of:

  # We're working on customizable envs.
  session = await Session.create(id="Nodejs")
  await session.close()

asyncio.new_event_loop().run_until_complete(main())