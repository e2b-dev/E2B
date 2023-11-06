from e2b import Sandbox

sandbox = Sandbox(id="base")

url = sandbox.get_hostname()  # $HighlightLine
print("https://" + url)

sandbox.close()
