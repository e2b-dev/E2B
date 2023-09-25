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

  # 2. Start a process that will clone a repository
  proc = await session.process.start( # $HighlightLine
    cmd="git clone https://github.com/cruip/open-react-template.git /code/open-react-template", # $HighlightLine
    on_stdout=print_out, # $HighlightLine
    on_stderr=print_out, # $HighlightLine
  ) # $HighlightLine
  # 3. Wait for the process to finish
  await proc

  # Optional: 4. List the cntent of cloned repo
  content = await session.filesystem.list('/code/open-react-template')
  print(content)

  # Optional: 5. Install deps
  print("Installing deps...")
  proc = await session.process.start(
    cmd="npm install",
    on_stdout=print_out,
    on_stderr=print_out,
    cwd="/code/open-react-template"
  )

  await proc

  await session.close()

asyncio.run(main())
