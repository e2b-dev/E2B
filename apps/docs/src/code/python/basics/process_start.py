from e2b import Sandbox

sandbox = Sandbox(id="base")

npm_init = sandbox.process.start("npm init -y")  # $HighlightLine
npm_init.wait()
print(npm_init.stdout)

sandbox.close()
