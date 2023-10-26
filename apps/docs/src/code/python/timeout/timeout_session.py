from e2b import Session

# Timeout 3s for the session to open
session = Session.create(id="Nodejs", timeout=3) # $HighlightLine

session.close()
