import asyncio
import logging

from e2b import Session

id = "PPSrlH5TIvFx"

logging.basicConfig(level=logging.INFO)


async def main():
    session = Session(id=id)
    await session.open()

    res = await session.filesystem.read("/etc/hosts")
    print("RESULT", res)
    await session.filesystem.write("test.txt", "Hello World")

    f = await session.filesystem.read("test.txt")
    print("RESULT read2", f)

    proc = await session.process.start("ls -la")
    await proc.finished

    await session.close()


asyncio.new_event_loop().run_until_complete(main())
