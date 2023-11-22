from e2b import Sandbox


def print_out(output):
    print(output.line)


# 1. Start the playground sandbox
sandbox = Sandbox(
    # You can pass your own sandbox template id
    template="base",
)

# 2. Save the JavaScript code to a file inside the playground
code = """
  const fs = require('fs');
  const dirContent = fs.readdirSync('/');
  dirContent.forEach((item) => {
    console.log('Root dir item inside playground:', item);
  });
"""
sandbox.filesystem.write("/code/index.js", code)

# 3. Start the execution of the JavaScript file we saved
proc = sandbox.process.start(  # $HighlightLine
    cmd="node /code/index.js",  # $HighlightLine
    # 4. Stream stdout, stderr
    on_stdout=print_out,  # $HighlightLine
    on_stderr=print_out,  # $HighlightLine
)  # $HighlightLine

# 4. Wait for the process to finish
proc.wait()

# 5. Or you can access output after the process has finished
output = proc.output

sandbox.close()
