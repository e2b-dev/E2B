import asyncio
from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")

  # This example will print back the string we send to the process using `send_stdin`

  proc = await session.process.start(
      "while IFS= read -r line; do echo \"$line\"; sleep 1; done",
      on_stdout=print,
  )
  await proc.send_stdin("marco\n")
  await proc.kill()

  await session.close()

asyncio.new_event_loop().run_until_complete(main())