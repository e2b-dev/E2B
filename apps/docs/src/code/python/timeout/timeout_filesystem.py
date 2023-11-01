from e2b import Session

session = Session.create(id="Nodejs")

# Timeout 3s for the write operation
session.filesystem.write("test.txt", "Hello World", timeout=3) # $HighlightLine

# Timeout 3s for the list operation
dir_content = session.filesystem.list(".", timeout=3) # $HighlightLine
print(dir_content)

# Timeout 3s for the read operation
file_content = session.filesystem.read("test.txt", timeout=3) # $HighlightLine
print(file_content)

session.close()