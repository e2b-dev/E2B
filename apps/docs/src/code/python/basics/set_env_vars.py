from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
    session = Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        env_vars={"FOO": "Hello"}  # $HighlightLine
    )

    proc = session.process.start(
        "echo $FOO $BAR!",
        env_vars={"BAR": "World"},  # $HighlightLine
    )
    proc.proc()
    print(proc.output.stdout)
    # output: Hello World!

    session.close()


main()