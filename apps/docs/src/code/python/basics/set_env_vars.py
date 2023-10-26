from e2b import Session

session = Session.create(
    id="Nodejs",
    env_vars={"FOO": "Hello"}  # $HighlightLine
)

proc = session.process.start(
    "echo $FOO $BAR!",
    env_vars={"BAR": "World"},  # $HighlightLine
)
proc.wait()

print(proc.output.stdout)
# output: Hello World!

session.close()