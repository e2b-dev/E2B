import asyncio
import logging
from os import getenv

from e2b import Session, run_code

id = "Python3"
E2B_API_KEY = getenv("E2B_API_KEY")


logging.basicConfig(level=logging.ERROR)


async def main():
    # s = Session("Nodejs", api_key=E2B_API_KEY)
    # await s.open()
    # await s.close()

    stdout, stderr = await run_code("Node16", "console.log('hello world'); throw new Error('error')")
    print(stdout)
    print(stderr)
    return

    session = await Session.create(id)

    # proc = await session.terminal.start(
    #     rootdir="/code",
    #     cols=80,
    #     rows=24,
    #     on_data=lambda data: print("DATA", data),
    #     cmd="ls",
    # )

    # out = proc.output

    # out = await proc
    # print("OUT", out)

    # await proc.finished
    proc = await session.process.start(
        "ls",
        rootdir="/",
        on_stderr=lambda data: print("ERR", data),
        on_stdout=lambda data: print("OUT", data),
    )
    output = await proc

    # output.lines

    print(output.messages)

    await session.close()
    return
    await session.filesystem.write("test.txt", "Hello World")

    f = await session.filesystem.read("test.txt")
    print("RESULT read2", f)

    await session.filesystem.make_dir("test")
    ls = await session.filesystem.list("/")
    print("RESULT ls", [ls for ls in ls if ls.is_dir and ls.name == "test"])

    await session.filesystem.remove("test")
    ls = await session.filesystem.list("/")
    print("RESULT ls", [ls for ls in ls if ls.is_dir and ls.name == "test"])

    w = await session.filesystem.watch_dir("/")

    w.add_event_listener(lambda e: print("EVENT", e))
    await w.start()

    print("PATH", w.path)

    await session.filesystem.make_dir("testx")

    await w.stop()

    def on_stdout(data):
        print("STDOUT", data)

    def on_stderr(data):
        print("STDERR", data)

    url = session.get_hostname(80)
    print("URL", url)

    proc = await session.process.start(
        "pwd",
        on_stdout=on_stdout,
        on_stderr=on_stderr,
        on_exit=lambda: print("EXIT"),
        rootdir="/code",
    )
    # await proc.send_stdin("lore olympus")
    # await proc.send_stdin("\nnew line too")

    # await proc.kill()

    print("end")

    await session.process.start(cmd="python3 -m http.server 8022")

    term = await session.terminal.start(
        on_data=lambda data: print("DATA", data),
        cols=80,
        rows=24,
        rootdir="/code",
    )

    await term.send_data("echo 1\n")

    # await term
    print("end")

    # await term.resize(80, 30)

    await term.kill()

    await session.close()

    # await asyncio.Future()


asyncio.run(main())
