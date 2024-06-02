import logging

from dotenv import load_dotenv
from e2b import Sandbox
import time

load_dotenv()

logging.basicConfig(level=logging.INFO)

start = time.time()

sbx = Sandbox()

process = sbx.process.start("echo 'hello, world'")

for event in process:
    print(event.stderr)

result = process.wait()
