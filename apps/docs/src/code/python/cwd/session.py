from e2b import Session

session = Session.create(
    id="Python3",
    cwd="/code",  # $HighlightLine
)

# You can also change the cwd of an existing session
session.cwd = "/home"  # $HighlightLine

session.close()