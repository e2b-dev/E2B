from e2b import Sandbox

sandbox = Sandbox.create(id="Nodejs")

url = sandbox.get_hostname() # $HighlightLine
print("https://" + url)

sandbox.close()
