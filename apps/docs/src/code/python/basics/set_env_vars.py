import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
    session = await Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        env_vars={"FOO": "Hello"}  # $HighlightLine
    )

    proc = await session.process.start(
        "echo $FOO $BAR!",
        env_vars={"BAR": "World"},  # $HighlightLine
    )
    await proc
    print(proc.output.stdout)
    # output: Hello World!

    await session.close()


asyncio.run(main())