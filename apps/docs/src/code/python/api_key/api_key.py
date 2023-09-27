import asyncio
from os import getenv

from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")


async def main():
    # You can pass an API key explicitly
    explicit_api_key = await Session.create(id="Nodejs", api_key=E2B_API_KEY)
    await explicit_api_key.close()

    # If you don't pass an API key, the SDK will look for it in the E2B_API_KEY environment variable
    api_key_from_env_variable = await Session.create(id="Nodejs")
    await api_key_from_env_variable.close()


asyncio.run(main())
