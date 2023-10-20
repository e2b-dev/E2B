from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # `filesystem.make_dir()` will fail if any directory in the path doesn't exist

  # Create a new directory '/dir'
  session.filesystem.make_dir("/dir") # $HighlightLine

  session.close()

main()
