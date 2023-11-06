from e2b import Sandbox

sandbox = Sandbox(id="base")

# Timeout 3s for the process to start
npm_init = sandbox.process.start("npm init -y", timeout=3)  # $HighlightLine
npm_init.wait()

sandbox.close()
