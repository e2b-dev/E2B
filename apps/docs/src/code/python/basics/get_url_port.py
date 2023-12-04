from e2b import Sandbox

sandbox = Sandbox(template="base")

open_port = 3000
url = sandbox.get_hostname(open_port)  # $HighlightLine
print("https://" + url)

sandbox.close()
