from e2b import Sandbox

session = Sandbox.create(id="Nodejs")

with open('path/to/local/file', 'rb') as f:
  remote_path = session.upload_file(f) # $HighlightLine

session.close()
