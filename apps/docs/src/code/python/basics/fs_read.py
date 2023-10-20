from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  # Read the '/etc/hosts' file
  file_content = session.filesystem.read('/etc/hosts') # $HighlightLine

  # Prints something like:
  # 127.0.0.1       localhost
  print(file_content)

  session.close()

main()
