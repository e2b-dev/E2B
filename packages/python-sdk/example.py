import logging

from dotenv import load_dotenv
from e2b import Sandbox
import time

load_dotenv()

logging.basicConfig(level=logging.INFO)

start = time.time()

with Sandbox(
    # template="i32b48xtmbk9w5vfad1l",
    _debug_hostname="localhost",
    _debug_port=49982,
    _debug_dev_env="local",
) as sandbox:
    # print(sandbox.id)

    l = sandbox.filesystem.list("")

    end = time.time()

    print(f"Time taken: {end - start}")
