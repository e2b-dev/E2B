import logging
from os import getenv

from e2b.session.sync_main import SyncSession

id = "Python3"
E2B_API_KEY = getenv("E2B_API_KEY")

logging.basicConfig(level=logging.ERROR)


def main():
    print("a")
    s = SyncSession("Nodejs", api_key=E2B_API_KEY)
    s.open()

    print(s.filesystem.list("/"))
    process = s.process.start(
        "ls",
        cwd="/",
        on_stderr=lambda data: print("ERR", data),
        on_stdout=lambda data: print("OUT", data),
    )

    # output.lines
    output = process.wait()
    print(output)
    s.close()


main()
