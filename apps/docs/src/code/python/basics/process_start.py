from e2b import Sandbox

session = Sandbox.create(id="Nodejs")

npm_init = session.process.start("npm init -y") # $HighlightLine
npm_init.wait()
print(npm_init.stdout)

session.close()