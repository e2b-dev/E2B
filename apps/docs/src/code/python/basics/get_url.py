from e2b import Sandbox

sandbox = Sandbox(template="base")

url = sandbox.get_sandbox_url()  # $HighlightLine
print(url)

sandbox.close()
