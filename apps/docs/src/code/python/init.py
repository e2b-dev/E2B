import asyncio
from e2b import Session

# You can use some of the predefined environments by using specific id:
# 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
# We'll support custom environments soon.
session_id = "Nodejs"

async def main():
  session = await Session.create(id=session_id)

  # Close the session once you're done.
  await session.close()

asyncio.new_event_loop().run_until_complete(main())