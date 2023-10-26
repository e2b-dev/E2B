from os import getenv
from e2b import Session

session = Session.create(id="Nodejs")

# Read the '/etc/hosts' file
file_content = session.filesystem.read('/etc/hosts') # $HighlightLine

# Prints something like:
# 127.0.0.1       localhost
print(file_content)

session.close()
