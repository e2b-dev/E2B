from e2b import Sandbox

sandbox = Sandbox.create(
    id="base",
    cwd="/code",  # $HighlightLine
)

# You can also change the cwd of an existing sandbox
sandbox.cwd = "/home"  # $HighlightLine

sandbox.close()
