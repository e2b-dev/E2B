from e2b import Session

session = Session.create(id="Nodejs")

# This example will print back the string we send to the process using `send_stdin()`

proc = session.process.start(
    "while IFS= read -r line; do echo \"$line\"; sleep 1; done",
    on_stdout=print,
)
proc.send_stdin("AI Playground\n") # $HighlightLine
proc.kill()

session.close()
