import asyncio
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


def print_stdout(output):
  print(output.line)

async def main():
  session = await Session.create(id="Python3", api_key=E2B_API_KEY)

  # Start a server process in the background
  # We are not using `await background_server` - that would wait for the process to finish running
  background_server = await session.process.start( # $HighlightLine
    "python3 -m http.server 8000", # $HighlightLine
    on_stdout=print_stdout, # $HighlightLine
  ) # $HighlightLine

  # Wait for the server to be accessible
  await asyncio.sleep(1)

  # Start another process that creates request to server
  server_request = await session.process.start("curl localhost:8000")

  # Wait for the server request to finish running
  request_output = await server_request.finished

  # Stop the background process (it would otherwise run indefinitely)
  await background_server.kill() # $HighlightLine

  # Access the server output after the server process is killed
  server_output = background_server.output  # $HighlightLine


  await session.close()


asyncio.run(main())
