from e2b import Sandbox

session = Sandbox.create(
    id="Python3",
    cwd="/code",  # $HighlightLine
)

# You can also change the cwd of an existing session
session.cwd = "/home"  # $HighlightLine

session.close()