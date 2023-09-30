import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
    session = await Session.create(
        id="Python3",
        cwd="/code",  # $HighlightLine
    )

    # You can also change the cwd of an existing session
    session.cwd = "/home"  # $HighlightLine

    await session.close()

asyncio.run(main())
