from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
  session = Session.create(id="Nodejs", api_key=E2B_API_KEY)

  url = session.get_hostname(3000) # $HighlightLine
  print("https://" + url)

  session.close()

main()
