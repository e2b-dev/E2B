from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

# 1. Start cloud playground
def main():
  # `id` can also be one of:
  # 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY) # $HighlightLine

  # 2. Use filesystem
  session.filesystem # $HighlightLine

  # 3. Start processes
  session.process.start() # $HighlightLine

  # 4. Upload/download files
  session.read_bytes() # $HighlightLine
  session.write_bytes() # $HighlightLine

  session.close()

main()