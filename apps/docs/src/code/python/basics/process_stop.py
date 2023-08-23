import asyncio

from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")

  npm_init = await session.process.start("npm init -y")
  await npm_init.kill()
  # There will be no output because we immediatelly kill the `npm_init` process
  print(npm_init.stdout)

  await session.close()

asyncio.new_event_loop().run_until_complete(main())