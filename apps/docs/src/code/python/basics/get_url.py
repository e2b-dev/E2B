from e2b import Session

session = Session.create(id="Nodejs")

url = session.get_hostname() # $HighlightLine
print("https://" + url)

session.close()
