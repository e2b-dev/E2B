from e2b import Session

session = Session.create(
    id="Python3",
    cwd="/home/user/code"  # $HighlightLine
)
session.filesystem.write("hello.txt", "Welcome to E2B!")  # $HighlightLine
proc = session.process.start("cat /home/user/code/hello.txt")
proc.wait()
print(proc.output.stdout)
# output: "Welcome to E2B!"

session.filesystem.write("../hello.txt", "We hope you have a great day!")  # $HighlightLine
proc2 = session.process.start("cat /home/user/hello.txt")
proc2.wait()
print(proc2.output.stdout)
# output: "We hope you have a great day!"

session.close()
