import asyncio
from e2b import Session

async def main():
  # `id` can also be one of:
  # 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  # We're working on custom environments.
  session = await Session.create(id="Nodejs")
  await session.close()

asyncio.new_event_loop().run_until_complete(main())