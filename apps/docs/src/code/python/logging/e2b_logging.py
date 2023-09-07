import asyncio
import logging
from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

# Global logging configuration
logging.basicConfig(level=logging.INFO, format="GLOBAL - [%(asctime)s] - %(name)-32s - %(levelname)7s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")


# Or configure only e2b logger

# Get e2b logger
e2b_logger = logging.getLogger("e2b")

# Set e2b logger level to INFO
e2b_logger.setLevel(logging.INFO)

# Setup formatter
formatter = logging.Formatter("E2B    - [%(asctime)s] - %(name)-32s - %(levelname)7s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

# Setup handler
handler = logging.StreamHandler()
handler.setFormatter(formatter)

# Add handler to e2b logger
e2b_logger.addHandler(handler)


async def main():
  session = await Session.create(id="Nodejs", api_key=E2B_API_KEY)
  await session.filesystem.write("test.txt", "Hello World")
  await session.close()

asyncio.run(main())
