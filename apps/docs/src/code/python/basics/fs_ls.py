from e2b import Session

session = Session.create(id="Nodejs")

# List the root directory
content = session.filesystem.list("/") # $HighlightLine
for item in content:
  print(f"Is '{item.name}' directory?", item.is_dir)

session.close()
