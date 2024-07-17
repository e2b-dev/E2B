from e2b import Sandbox

sandbox = Sandbox(template="base")

# Create a new directory '/dir'
sandbox.filesystem.make_dir("/dir")  # $HighlightLine

sandbox.close()
