from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
    session = Session.create(
        id="Python3",
        cwd="/code",  # $HighlightLine
    )

    # You can also change the cwd of an existing session
    session.cwd = "/home"  # $HighlightLine

    session.close()

main()
