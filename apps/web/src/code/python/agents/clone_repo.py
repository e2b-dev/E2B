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

    # 2. Start a process that will clone a repository
    proc = sandbox.process.start(  # $HighlightLine
        cmd="git clone https://github.com/cruip/open-react-template.git /code/open-react-template",  # $HighlightLine
        on_stdout=print_out,  # $HighlightLine
        on_stderr=print_out,  # $HighlightLine
    )  # $HighlightLine
    # 3. Wait for the process to finish
    proc.wait()

    # Optional: 4. List the cntent of cloned repo
    content = sandbox.filesystem.list("/code/open-react-template")
    print(content)

    # Optional: 5. Install deps
    print("Installing deps...")
    proc = sandbox.process.start(
        cmd="npm install",
        on_stdout=print_out,
        on_stderr=print_out,
        cwd="/code/open-react-template",
    )

    proc.wait()

    sandbox.close()


main()
