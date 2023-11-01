from e2b import Sandbox

sandbox = Sandbox.create(
    id="Nodejs",
    env_vars={"FOO": "Hello"}  # $HighlightLine
)

sandbox.close()
