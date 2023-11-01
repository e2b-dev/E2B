from os import getenv
from e2b import Session

session = Session.create(id="Nodejs")

content_in_bytes = bytearray(b"Hello world")

# `write_bytes` will write bytearray to a file inside the playground.
session.filesystem.write_bytes('/file', content_in_bytes) # $HighlightLine

# We can read the file back to verify the content
file_content = session.filesystem.read('/file')
print(file_content)

session.close()
