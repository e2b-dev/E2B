from e2b import Sandbox

sandbox = Sandbox(template="base")

content_in_bytes = bytearray(b"Hello world")

# `write_bytes` will write bytearray to a file inside the playground.
sandbox.filesystem.write_bytes("/file", content_in_bytes)  # $HighlightLine

# We can read the file back to verify the content
file_content = sandbox.filesystem.read("/file")
print(file_content)

sandbox.close()
