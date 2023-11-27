from e2b import Sandbox

sandbox = Sandbox(template="base")

npm_init = sandbox.process.start("npm init -y")
npm_init.kill()  # $HighlightLine

# There will be no output because we immediately kill the `npm_init` process
print(npm_init.stdout)

sandbox.close()
