from e2b import Sandbox

sandbox = Sandbox(
    id="base",
    env_vars={"FOO": "Hello"},  # $HighlightLine
)

sandbox.close()
