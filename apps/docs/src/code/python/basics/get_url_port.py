from e2b import Sandbox

sandbox = Sandbox(template="base")

open_port = 3000
url = sandbox.get_sandbox_url(open_port)  # $HighlightLine
print(url)

sandbox.close()
