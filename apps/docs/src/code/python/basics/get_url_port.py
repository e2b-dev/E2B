from e2b import Session

session = Session.create(id="Nodejs")

url = session.get_hostname(3000) # $HighlightLine
print("https://" + url)

session.close()
