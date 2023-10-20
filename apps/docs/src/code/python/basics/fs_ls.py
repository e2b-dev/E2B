from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # List the root directory
  content = session.filesystem.list("/") # $HighlightLine
  for item in content:
    print(item.name, "Is directory?", item.is_dir)

  session.close()

main()
