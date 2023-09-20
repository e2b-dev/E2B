import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def print_out(output):
  print(output.line)

async def main():
  # 1. Start the playground session
  session = await Session.create(
    # Select the right runtime
    id="Nodejs",
    api_key=E2B_API_KEY,
  )

  # 2. Start the shell commdand
  proc = await session.process.start( # $HighlightLine
    # Print names of all running processes
    cmd="ps aux | tr -s ' ' | cut -d ' ' -f 11", # $HighlightLine
    on_stdout=print_out, # $HighlightLine
    on_stderr=print_out, # $HighlightLine
  ) # $HighlightLine

  # 3. Wait for the process to finish
  await proc

  # 4. Or you can access output after the process has finished
  output = proc.output

  await session.close()

asyncio.run(main())