from e2b import Sandbox

sandbox = Sandbox(template="base")

# List the root directory
content = sandbox.filesystem.list("/")  # $HighlightLine
for item in content:
    print(f"Is '{item.name}' directory?", item.is_dir)

sandbox.close()
