from e2b import Sandbox

session = Sandbox.create(
    id="Nodejs",
    env_vars={"FOO": "Hello"}  # $HighlightLine
)

session.close()