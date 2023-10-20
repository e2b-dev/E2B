from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
    session = Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        on_stdout=lambda output: print("session", output.line),  # $HighlightLine
    )

    proc = session.process.start('echo "Hello World!"')
    proc.wait()
    # output: session Hello World!

    proc_with_custom_handler = session.process.start(
        'echo "Hello World!"',
        on_stdout=lambda output: print("process", output.line),  # $HighlightLine
    )
    proc_with_custom_handler.wait()
    # output: process Hello World!

    session.close()

main()
