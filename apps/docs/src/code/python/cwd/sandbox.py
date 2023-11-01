from e2b import Sandbox

sandbox = Sandbox.create(
    id="Python3",
    cwd="/code",  # $HighlightLine
)

# You can also change the cwd of an existing sandbox
sandbox.cwd = "/home"  # $HighlightLine

sandbox.close()
