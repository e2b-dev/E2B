from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # `filesystem.write()` will:
  # - create the file if it doesn't exist
  # - fail if any directory in the path doesn't exist
  # - overwrite the file if it exists

  # Write the content of the file '/hello.txt'
  session.filesystem.write("/hello.txt", "Hello World!") # $HighlightLine

  # The following would fail because '/dir' doesn't exist
  # session.filesystem.write("/dir/hello.txt", "Hello World!")

  session.close()

main()
