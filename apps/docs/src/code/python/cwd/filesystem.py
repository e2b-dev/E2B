import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
    session = await Session.create(
        id="Python3", cwd="/home/user/code"  # $HighlightLine
    )
    await session.filesystem.write("hello.txt", "Welcome to E2B!")  # $HighlightLine
    proc = await session.process.start("cat /home/user/code/hello.txt")
    await proc
    print(proc.output.stdout)
    # output: "Welcome to E2B!"

    await session.filesystem.write(
        "../hello.txt", "We hope you have a great day!"
    )  # $HighlightLine
    proc2 = await session.process.start("cat /home/user/hello.txt")
    await proc2
    print(proc2.output.stdout)
    # output: "We hope you have a great day!"

    await session.close()

asyncio.run(main())
