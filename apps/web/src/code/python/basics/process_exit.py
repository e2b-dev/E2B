from e2b import Sandbox

sandbox = Sandbox(
    template="base",
    on_exit=lambda: print("[sandbox]", "process ended"),  # $HighlightLine
)

proc = sandbox.process.start('echo "Hello World!"')
proc.wait()
# output: [sandbox] process ended

proc_with_custom_handler = sandbox.process.start(
    'echo "Hello World!"',
    on_exit=lambda: print("[process]", "process ended"),  # $HighlightLine
)
proc_with_custom_handler.wait()
# output: [process] process ended

sandbox.close()
