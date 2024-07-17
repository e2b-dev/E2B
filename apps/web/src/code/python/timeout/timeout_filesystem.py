from e2b import Sandbox

sandbox = Sandbox(template="base")

# Timeout 3s for the write operation
sandbox.filesystem.write("test.txt", "Hello World", timeout=3)  # $HighlightLine

# Timeout 3s for the list operation
dir_content = sandbox.filesystem.list(".", timeout=3)  # $HighlightLine
print(dir_content)

# Timeout 3s for the read operation
file_content = sandbox.filesystem.read("test.txt", timeout=3)  # $HighlightLine
print(file_content)

sandbox.close()
