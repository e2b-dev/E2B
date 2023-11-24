from os import getenv

from e2b import Sandbox

E2B_API_KEY = getenv("E2B_API_KEY")


def print_out(output):
    print(output.line)


def main():
    # 1. Start the playground sandbox
    sandbox = Sandbox(
        # Select the right runtime
        template="base",
        api_key=E2B_API_KEY,
    )

    # 2. Start the shell commdand
    proc = sandbox.process.start(  # $HighlightLine
        # Print names of all running processes
        cmd="ps aux | tr -s ' ' | cut -d ' ' -f 11",  # $HighlightLine
        on_stdout=print_out,  # $HighlightLine
        on_stderr=print_out,  # $HighlightLine
    )  # $HighlightLine

    # 3. Wait for the process to finish
    proc.wait()

    # 4. Or you can access output after the process has finished
    output = proc.output

    sandbox.close()


main()
