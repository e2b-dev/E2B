from e2b import Sandbox

sandbox = Sandbox(
    template="base",
    on_stderr=lambda output: print("[sandbox]", output.line),  # $HighlightLine
)

# This command will fail and output to stderr because Golang isn't installed in the cloud playground
proc = sandbox.process.start("go version")
proc.wait()
# output: [sandbox] /bin/bash: line 1: go: command not found

proc_with_custom_handler = sandbox.process.start(
    "go version",
    on_stderr=lambda output: print("[process]", output.line),  # $HighlightLine
)
proc_with_custom_handler.wait()
# output: [process] /bin/bash: line 1: go: command not found

sandbox.close()
