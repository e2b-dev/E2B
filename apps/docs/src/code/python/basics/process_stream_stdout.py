from e2b import Sandbox

session = Sandbox.create(
    id="Nodejs",
    on_stdout=lambda output: print("sandbox", output.line),  # $HighlightLine
)

proc = session.process.start('echo "Hello World!"')
proc.wait()
# output: session Hello World!

proc_with_custom_handler = session.process.start(
    'echo "Hello World!"',
    on_stdout=lambda output: print("process", output.line),  # $HighlightLine
)
proc_with_custom_handler.wait()
# output: process Hello World!

session.close()