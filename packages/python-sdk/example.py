import logging

from dotenv import load_dotenv
from e2b import Sandbox

load_dotenv()

logging.basicConfig(level=logging.ERROR)

with Sandbox() as sandbox:
    print(sandbox.id)
