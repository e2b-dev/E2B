from e2b import Sandbox

sandbox = Sandbox(id="base")

# `filesystem.make_dir()` will fail if any directory in the path doesn't exist

# Create a new directory '/dir'
sandbox.filesystem.make_dir("/dir")  # $HighlightLine

sandbox.close()
