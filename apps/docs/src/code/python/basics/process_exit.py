import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
    session = await Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        on_exit=lambda: print("[session]", "process ended"),  # $HighlightLine
    )

    proc = await session.process.start('echo "Hello World!"')
    await proc
    # output: [session] process ended

    proc_with_custom_handler = await session.process.start(
        'echo "Hello World!"',
        on_exit=lambda: print("[process]", "process ended"),  # $HighlightLine
    )
    await proc_with_custom_handler
    # output: [process] process ended

    await session.close()

asyncio.run(main())
