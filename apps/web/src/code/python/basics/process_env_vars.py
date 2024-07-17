from e2b import Sandbox

sandbox = Sandbox(
    template="base",
    env_vars={"FOO": "Hello"}
)

proc = sandbox.process.start(
    "echo $FOO $BAR!",
    env_vars={"BAR": "World"},  # $HighlightLine
)
proc.wait()

print(proc.output.stdout)
# output: Hello World!

sandbox.close()
