from e2b import Sandbox

sandbox = Sandbox(template="base", cwd="/code")  # $HighlightLine
sandbox_cwd = sandbox.process.start("pwd")  # $HighlightLine
sandbox_cwd.wait()
print(sandbox_cwd.output.stdout)
# output: "/code"

process_cwd = sandbox.process.start("pwd", cwd="/home")  # $HighlightLine
process_cwd.wait()
print(process_cwd.output.stdout)
# output: "/home"

sandbox.close()
