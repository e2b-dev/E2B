from e2b import Sandbox

sandbox = Sandbox(template="base")

# This example will print back the string we send to the process using `send_stdin()`

proc = sandbox.process.start(
    'while IFS= read -r line; do echo "$line"; sleep 1; done',
    on_stdout=print,
)
proc.send_stdin("AI Playground\n")  # $HighlightLine
proc.kill()

sandbox.close()
