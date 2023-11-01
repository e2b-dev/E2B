from e2b import Sandbox

sandbox = Sandbox.create(id="Nodejs")

with open('path/to/local/file', 'rb') as f:
    remote_path = sandbox.upload_file(f)  # $HighlightLine

sandbox.close()
