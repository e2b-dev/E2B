import time

from e2b import Sandbox

sandbox = Sandbox.create()

watcher = sandbox.files.watch_dir("/home")  # $HighlightLine

# Create files in the /home directory inside the playground
# We'll receive notifications for these events through the watcher we created above.
for i in range(10):
    # `filesystem.write()` will trigger two events:
    # 1. 'Create' when the file is created
    # 2. 'Write' when the file is written to
    sandbox.files.write(f"/home/file{i}.txt", f"Hello World {i}!")
    time.sleep(1)

for event in watcher.get():
    print(f"Event: {event.type} {event.name}")  # $HighlightLine

watcher.stop()
sandbox.kill()
