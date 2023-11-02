from e2b import Sandbox

sandbox = Sandbox.create(
    id="base",
    env_vars={"FOO": "Hello"}  # $HighlightLine
)

sandbox.close()
