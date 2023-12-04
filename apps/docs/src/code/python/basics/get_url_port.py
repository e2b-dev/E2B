from e2b import Sandbox

sandbox = Sandbox(template="base")

open_port = 3000
url = f"https://{sandbox.get_hostname(open_port)}"  # $HighlightLine
print(url)

sandbox.close()
