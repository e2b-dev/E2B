import asyncio

from service_connection import SessionConnection


async def main():
    session = SessionConnection()
    await session.open()
    await asyncio.sleep(10)
    await session.close()


asyncio.new_event_loop().run_until_complete(main())
