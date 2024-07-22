import time
from os import getenv

from e2b import Sandbox

E2B_API_KEY = getenv("E2B_API_KEY")


def print_stdout(output):
    print(output.line)


def main():
    sandbox = Sandbox(template="base", api_key=E2B_API_KEY)

    # Start a server process in the background
    # We are not using `background_server.wait()` - that would wait for the process to finish running
    background_server = sandbox.process.start(  # $HighlightLine
        "python3 -m http.server 8000",  # $HighlightLine
        on_stdout=print_stdout,  # $HighlightLine
    )  # $HighlightLine

    # Wait for the server to be accessible
    time.sleep(1)

    # Start another process that creates request to server
    server_request = sandbox.process.start("curl localhost:8000")

    # Wait for the server request to finish running
    request_output = server_request.wait()

    # Stop the background process (it would otherwise run indefinitely)
    background_server.kill()  # $HighlightLine

    # Access the server output after the server process is killed
    server_output = background_server.output  # $HighlightLine

    sandbox.close()


main()
