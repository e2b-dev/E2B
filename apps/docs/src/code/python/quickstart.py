from os import getenv

from e2b import Sandbox

E2B_API_KEY = getenv("E2B_API_KEY")

# 1. Start cloud playground
def main():
    # `id` can be your own template id
    sandbox = Sandbox(id="base", api_key=E2B_API_KEY)  # $HighlightLine

    # 2. Use filesystem
    sandbox.filesystem  # $HighlightLine

    # 3. Start processes
    sandbox.process.start()  # $HighlightLine

    # 4. Upload/download files
    sandbox.read_bytes()  # $HighlightLine
    sandbox.write_bytes()  # $HighlightLine

    sandbox.close()

main()
