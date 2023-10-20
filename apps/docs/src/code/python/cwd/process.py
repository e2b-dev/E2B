from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
    session = Session.create(id="Python3", cwd="/code")  # $HighlightLine
    session_cwd = session.process.start("pwd")  # $HighlightLine
    session_cwd
    print(session_cwd.output.stdout)
    # output: "/code"

    process_cwd = session.process.start("pwd", cwd="/home")  # $HighlightLine
    process_cwd.wait()
    print(process_cwd.output.stdout)
    # output: "/home"

    session.close()

main()
