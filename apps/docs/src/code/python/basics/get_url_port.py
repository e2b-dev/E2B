from e2b import Sandbox

sandbox = Sandbox(template="base")

open_port = 3000
url = sandbox.get_hostname_with_protocol(open_port)  # $HighlightLine
print(url)

sandbox.close()
