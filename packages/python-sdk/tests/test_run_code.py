from os import getenv

from e2b import run_code

E2B_API_KEY = getenv("E2B_API_KEY")

async def test_run_code():
  code = "console.log('hello'); throw new Error('error')"
  stdout, stderr = await run_code("Node16", code)

  assert stdout == "hello"
  assert "Error: error" in stderr
