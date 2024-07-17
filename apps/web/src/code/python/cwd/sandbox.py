from e2b import Sandbox

sandbox = Sandbox(
    template="base",
    cwd="/code",  # $HighlightLine
)

# You can also change the cwd of an existing sandbox
sandbox.cwd = "/home"  # $HighlightLine

sandbox.close()
