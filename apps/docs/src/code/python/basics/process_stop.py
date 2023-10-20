from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  npm_init = session.process.start("npm init -y")
  npm_init.kill() # $HighlightLine
  # There will be no output because we immediately kill the `npm_init` process
  print(npm_init.stdout)

  session.close()

main()
