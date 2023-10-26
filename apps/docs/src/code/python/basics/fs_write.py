from e2b import Session

session = Session.create(id="Nodejs")

# `filesystem.write()` will:
# - create the file if it doesn't exist
# - fail if any directory in the path doesn't exist
# - overwrite the file if it exists

# Write the content of the file '/hello.txt'
session.filesystem.write("/hello.txt", "Hello World!") # $HighlightLine

# The following would fail because '/dir' doesn't exist
# session.filesystem.write("/dir/hello.txt", "Hello World!")

session.close()
