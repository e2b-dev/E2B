import asyncio
from e2b import Session

async def main():
  session = await Session.create(id="Nodejs")

  # Read the '/etc/hosts' file
  file_content = await session.filesystem.read('/etc/hosts')

  # Prints something like:
  # 127.0.0.1       localhost
  # ::1     localhost ip6-localhost ip6-loopback
  # fe00::0 ip6-localnet
  # ff00::0 ip6-mcastprefix
  # ff02::1 ip6-allnodes
  # ff02::2 ip6-allrouters
  # 172.17.0.17     77c7a543226b
  print(file_content)

  await session.close()

asyncio.new_event_loop().run_until_complete(main())