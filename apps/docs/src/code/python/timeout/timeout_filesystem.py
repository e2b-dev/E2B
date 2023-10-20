from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # Timeout for the write operation
  session.filesystem.write("test.txt", "Hello World", timeout=3) # $HighlightLine

  # Timeout for the list operation
  session.filesystem.list(".", timeout=3) # $HighlightLine

  # Timeout for the read operation
  session.filesystem.read("test.txt", timeout=3) # $HighlightLine

  session.close()

main()
