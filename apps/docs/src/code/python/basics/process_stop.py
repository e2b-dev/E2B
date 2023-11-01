from e2b import Sandbox

session = Sandbox.create(id="Nodejs")

npm_init = session.process.start("npm init -y")
npm_init.kill() # $HighlightLine

# There will be no output because we immediately kill the `npm_init` process
print(npm_init.stdout)

session.close()
