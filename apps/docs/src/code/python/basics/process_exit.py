from os import getenv
from e2b import Session

E2B_API_KEY = getenv("E2B_API_KEY")

def main():
    session = Session.create(
        id="Nodejs",
        api_key=E2B_API_KEY,
        on_exit=lambda: print("[session]", "process ended"),  # $HighlightLine
    )

    proc = session.process.start('echo "Hello World!"')
    proc.wait()
    # output: [session] process ended

    proc_with_custom_handler = session.process.start(
        'echo "Hello World!"',
        on_exit=lambda: print("[process]", "process ended"),  # $HighlightLine
    )
    proc_with_custom_handler.wait()
    # output: [process] process ended

    session.close()

main()
