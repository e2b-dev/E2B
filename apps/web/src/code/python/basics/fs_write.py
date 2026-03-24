from e2b import Sandbox

sandbox = Sandbox(template="base")

# `filesystem.write()` will:
# - create the file if it doesn't exist
# - fail if any directory in the path doesn't exist
# - overwrite the file if it exists

# Write the content of the file '/hello.txt'
sandbox.filesystem.write("/hello.txt", "Hello World!")  # $HighlightLine

# The following would fail because '/dir' doesn't exist
# sandbox.filesystem.write("/dir/hello.txt", "Hello World!")

sandbox.close()
