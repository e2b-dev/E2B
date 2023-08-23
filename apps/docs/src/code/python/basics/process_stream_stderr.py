import asyncio
from e2b import Session

def print_stderr(output):
  print(output.line)

async def main():
  session = await Session.create(id="Nodejs")

  # This command will fail and output to stderr because Golang isn't installed in the cloud playground
  golang_version = await session.process.start(
    "go version",
    on_stderr=print_stderr,
  )
  await golang_version

  await session.close()

asyncio.new_event_loop().run_until_complete(main())