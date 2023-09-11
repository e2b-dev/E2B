import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def print_stdout(output):
  print(output.line)

async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)

  npm_init = await session.process.start(
    "npm init -y",
    on_stdout=print_stdout, # $HighlightLine
  )
  await npm_init

  await session.close()

asyncio.run(main())
