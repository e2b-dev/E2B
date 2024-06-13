import io

from e2b import Sandbox

s = Sandbox()

input = io.StringIO("This goes into the read buffer.")

s.files.write("/tmp/test.txt", input)

