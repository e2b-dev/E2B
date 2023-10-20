from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # Timeout for the process to start
  npm_init = session.process.start("npm init -y", timeout=5) # $HighlightLine
  npm_init.wait()

  session.close()

main()
