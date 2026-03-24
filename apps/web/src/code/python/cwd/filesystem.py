from e2b import Sandbox

sandbox = Sandbox(
    template="base",
    cwd="/home/user/code"  # $HighlightLine
)
sandbox.filesystem.write("hello.txt", "Welcome to E2B!")  # $HighlightLine
proc = sandbox.process.start("cat /home/user/code/hello.txt")
proc.wait()
print(proc.output.stdout)
# output: "Welcome to E2B!"

sandbox.filesystem.write("../hello.txt", "We hope you have a great day!")  # $HighlightLine
proc2 = sandbox.process.start("cat /home/user/hello.txt")
proc2.wait()
print(proc2.output.stdout)
# output: "We hope you have a great day!"

sandbox.close()
