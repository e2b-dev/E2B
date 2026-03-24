from e2b import Sandbox

sandbox = Sandbox(template="base")

file_in_bytes = sandbox.download_file("path/to/remote/file/inside/sandbox")  # $HighlightLine
# Save file to local filesystem
with open("path/to/local/file", "wb") as f:  # $HighlightLine
    f.write(file_in_bytes)  # $HighlightLine

sandbox.close()
