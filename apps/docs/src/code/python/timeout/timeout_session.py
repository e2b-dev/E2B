from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  # Timeout for the session to open
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY, timeout=5) # $HighlightLine

  session.close()

main()
