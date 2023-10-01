import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

async def main():
    session = await Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        on_stderr=lambda output: print("[session]", output.line),  # $HighlightLine
    )

    # This command will fail and output to stderr because Golang isn't installed in the cloud playground
    proc = await session.process.start("go version")
    await proc
    # output: [session] /bin/bash: line 1: go: command not found

    proc_with_custom_handler = await session.process.start(
        "go version",
        on_stderr=lambda output: print("[process]", output.line),  # $HighlightLine
    )
    await proc_with_custom_handler
    # output: [process] /bin/bash: line 1: go: command not found

    await session.close()

asyncio.run(main())
