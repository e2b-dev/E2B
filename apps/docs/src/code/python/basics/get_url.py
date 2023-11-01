from e2b import Sandbox

session = Sandbox.create(id="Nodejs")

url = session.get_hostname() # $HighlightLine
print("https://" + url)

session.close()
