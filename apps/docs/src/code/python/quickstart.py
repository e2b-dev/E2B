from e2b import Sandbox

# 1. Start cloud playground
sandbox = Sandbox()  # $HighlightLine

# 2. Use filesystem
sandbox.filesystem  # $HighlightLine

# 3. Start processes
sandbox.process.start()  # $HighlightLine

# 4. Upload/download files
sandbox.read_bytes()  # $HighlightLine
sandbox.write_bytes()  # $HighlightLine

sandbox.close()
