from e2b import Sandbox

sandbox = Sandbox(id="base")

# Create a new directory '/dir'
sandbox.filesystem.make_dir("/dir")  # $HighlightLine

sandbox.close()
