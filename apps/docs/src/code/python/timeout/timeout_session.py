from e2b import Sandbox

# Timeout 3s for the session to open
session = Sandbox.create(id="Nodejs", timeout=3) # $HighlightLine

session.close()
