from e2b import Session

session = Session.create(
    id="Nodejs",
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