from e2b import Sandbox

sandbox = Sandbox(
    template="base",
    on_stdout=lambda output: print("sandbox", output.line),  # $HighlightLine
)

proc = sandbox.process.start('echo "Hello World!"')
proc.wait()
# output: sandbox Hello World!

proc_with_custom_handler = sandbox.process.start(
    'echo "Hello World!"',
    on_stdout=lambda output: print("process", output.line),  # $HighlightLine
)
proc_with_custom_handler.wait()
# output: process Hello World!

sandbox.close()
