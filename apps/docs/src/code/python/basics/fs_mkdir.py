from e2b import Sandbox

session = Sandbox.create(id="Nodejs")

# `filesystem.make_dir()` will fail if any directory in the path doesn't exist

# Create a new directory '/dir'
session.filesystem.make_dir("/dir") # $HighlightLine

session.close()