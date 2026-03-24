import logging
from os import getenv

from e2b import Sandbox

E2B_API_KEY = getenv("E2B_API_KEY")

# Global logging configuration
logging.basicConfig(level=logging.INFO, format="GLOBAL - [%(asctime)s] - %(name)-32s - %(levelname)7s: %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S")  # $HighlightLine

# Or configure only e2b logger

# Get e2b logger
e2b_logger = logging.getLogger("e2b")  # $HighlightLine

# Set e2b logger level to INFO
e2b_logger.setLevel(logging.INFO)  # $HighlightLine

# Setup formatter
formatter = logging.Formatter("E2B    - [%(asctime)s] - %(name)-32s - %(levelname)7s: %(message)s",
                              datefmt="%Y-%m-%d %H:%M:%S")

# Setup handler
handler = logging.StreamHandler()
handler.setFormatter(formatter)

# Add handler to e2b logger
e2b_logger.addHandler(handler)  # $HighlightLine


def main():
    sandbox = Sandbox(template="base", api_key=E2B_API_KEY)
    sandbox.filesystem.write("test.txt", "Hello World")
    sandbox.close()


main()
