from e2b import Sandbox

sandbox = Sandbox(id="base")

# List the root directory
content = sandbox.filesystem.list("/")  # $HighlightLine
for item in content:
    print(f"Is '{item.name}' directory?", item.is_dir)

sandbox.close()
