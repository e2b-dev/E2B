from e2b import Sandbox

session = Sandbox.create(id="Nodejs")

open_port = 3000
url = session.get_hostname(open_port) # $HighlightLine
print("https://" + url)

session.close()
