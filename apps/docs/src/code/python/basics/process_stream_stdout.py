import asyncio
from os import getenv

from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


async def main():
    session = await Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        on_stdout=lambda output: print("session", output.line),  # $HighlightLine
    )

    proc = await session.process.start('echo "Hello World!"')
    await proc
    # output: session Hello World!

    proc_with_custom_handler = await session.process.start(
        'echo "Hello World!"',
        on_stdout=lambda output: print("process", output.line),  # $HighlightLine
    )
    await proc_with_custom_handler
    # output: process Hello World!

    await session.close()


asyncio.run(main())
