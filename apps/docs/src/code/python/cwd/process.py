import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
    session = await Session.create(id="Python3", cwd="/code")  # $HighlightLine
    session_cwd = await session.process.start("pwd")  # $HighlightLine
    await session_cwd
    print(session_cwd.output.stdout)
    # output: "/code"

    process_cwd = await session.process.start("pwd", cwd="/home")  # $HighlightLine
    await process_cwd
    print(process_cwd.output.stdout)
    # output: "/home"

    await session.close()

asyncio.run(main())
