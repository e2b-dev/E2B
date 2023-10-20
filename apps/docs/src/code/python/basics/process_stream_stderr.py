from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
    session = Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        on_stderr=lambda output: print("[session]", output.line),  # $HighlightLine
    )

    # This command will fail and output to stderr because Golang isn't installed in the cloud playground
    proc = session.process.start("go version")
    proc.wait()
    # output: [session] /bin/bash: line 1: go: command not found

    proc_with_custom_handler = session.process.start(
        "go version",
        on_stderr=lambda output: print("[process]", output.line),  # $HighlightLine
    )
    proc_with_custom_handler.wait()
    # output: [process] /bin/bash: line 1: go: command not found

    session.close()

main()
