from e2b import Sandbox

sandbox = Sandbox(template="base")

# Read the '/etc/hosts' file
file_content = sandbox.filesystem.read("/etc/hosts")  # $HighlightLine

# Prints something like:
# 127.0.0.1       localhost
print(file_content)

sandbox.close()
