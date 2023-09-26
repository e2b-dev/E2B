from typing import Literal, Union
from os import getenv

from . import Session

CodeRuntime = Literal[
  "Node16",
  "Python3",
]

async def run_code(
  runtime: Union[CodeRuntime, str],
  code: str,
):
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
    api_key=getenv("E2B_API_KEY"),
  )
  await session.filesystem.write(filepath, code)

  proc = await session.process.start(
    cmd=f'{binary} {filepath}',
  )
  await proc

  await session.close()

  return proc.output.stdout, proc.output.stderr
