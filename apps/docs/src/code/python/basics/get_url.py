from e2b import Sandbox

sandbox = Sandbox.create(id="base")

url = sandbox.get_hostname()  # $HighlightLine
print("https://" + url)

sandbox.close()
