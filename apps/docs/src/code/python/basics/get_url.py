from e2b import Sandbox

sandbox = Sandbox(template="base")

url = sandbox.get_hostname()  # $HighlightLine
print("https://" + url)

sandbox.close()
