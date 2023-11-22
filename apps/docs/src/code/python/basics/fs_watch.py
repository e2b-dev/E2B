import time

from e2b import Sandbox

watcher = None


def create_watcher(sandbox):  # $HighlightLine
    # Start filesystem watcher for the /home directory
    watcher = sandbox.filesystem.watch_dir("/home")  # $HighlightLine
    watcher.add_event_listener(lambda event: print(event))  # $HighlightLine
    watcher.start()  # $HighlightLine


sandbox = Sandbox(template="base")

create_watcher(sandbox)  # $HighlightLine

# Create files in the /home directory inside the playground
# We'll receive notifications for these events through the watcher we created above.
for i in range(10):
    # `filesystem.write()` will trigger two events:
    # 1. 'Create' when the file is created
    # 2. 'Write' when the file is written to
    sandbox.filesystem.write(f"/home/file{i}.txt", f"Hello World {i}!")
    time.sleep(1)

sandbox.close()
