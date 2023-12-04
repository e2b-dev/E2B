from e2b import Sandbox

sandbox = Sandbox(template="base")

url = sandbox.get_protocol()  # $HighlightLine
print(url)

sandbox.close()
