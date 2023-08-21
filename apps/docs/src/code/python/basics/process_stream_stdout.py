import asyncio
from e2b import Session

def print_stdout(output):
  print(output.line)

async def main():
  session = await Session.create(id="Nodejs")

  npm_init = await session.process.start(
    "npm init -y",
    on_stdout=lambda output: print_stdout(output),
  )
  await npm_init

  await session.close()

asyncio.new_event_loop().run_until_complete(main())