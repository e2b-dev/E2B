import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
  # `id` can also be one of:
  # 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  # We're working on custom environments.
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)
  await session.close()

asyncio.new_event_loop().run_until_complete(main())