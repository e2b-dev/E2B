from typing import Literal, Union, Optional
from os import getenv

from . import Session

CodeRuntime = Literal[
  "Node16",
  "Python3",
]

async def run_code(
  runtime: Union[CodeRuntime, str],
  code: str,
  api_key: Optional[str] = getenv("E2B_API_KEY"),
):
  """
  Runs code in a sandboxed cloud playground and return the stdout and stderr
  `run_ode` wraps the `Session` class and provides a simple interface for running code in a sandboxed environment
  without any need to manage lifecycle of the session.
  `run_code` automatically loads the E2B API key from the `E2B_API_KEY` environment variable.

  :param runtime: The runtime to run the code in. One of "Node16" or "Python3".
  :param code: The code to run

  :return: A string touple of stdout and stderr
  """
  binary = ""
  filepath = ""
  env_id = ""
  if runtime == "Node16":
    env_id = "Nodejs"
    binary = "node"
    filepath = "/index.js"
  elif runtime == "Python3":
    env_id = "Python3"
    binary = "python3"
    filepath = "/index.py"
  else:
    raise Exception(f'Invalid runtime "{runtime}". Please contactus if you need support for this runtime')

  session = await Session.create(
    id=env_id,
    api_key=api_key,
  )
  await session.filesystem.write(filepath, code)

  proc = await session.process.start(
    cmd=f'{binary} {filepath}',
  )
  await proc

  await session.close()

  return proc.output.stdout, proc.output.stderr
