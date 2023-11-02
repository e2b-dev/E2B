from e2b import Sandbox

# Timeout 3s for the sandbox to open
sandbox = Sandbox.create(id="base", timeout=3)  # $HighlightLine

sandbox.close()
