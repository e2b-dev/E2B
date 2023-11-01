from e2b import Sandbox

session = Sandbox.create(
    id="Nodejs",
    on_exit=lambda: print("[sandbox]", "process ended"), # $HighlightLine
)

proc = session.process.start('echo "Hello World!"')
proc.wait()
# output: [session] process ended

proc_with_custom_handler = session.process.start(
    'echo "Hello World!"',
    on_exit=lambda: print("[process]", "process ended"), # $HighlightLine
)
proc_with_custom_handler.wait()
# output: [process] process ended

session.close()
