from e2b import Sandbox

session = Sandbox.create(id="Python3", cwd="/code")  # $HighlightLine
session_cwd = session.process.start("pwd")  # $HighlightLine
session_cwd.wait()
print(session_cwd.output.stdout)
# output: "/code"

process_cwd = session.process.start("pwd", cwd="/home")  # $HighlightLine
process_cwd.wait()
print(process_cwd.output.stdout)
# output: "/home"

session.close()

