from e2b import Session

session = Session.create(id="Nodejs")

# Timeout 3s for the process to start
npm_init = session.process.start("npm init -y", timeout=3) # $HighlightLine
npm_init.wait()

session.close()