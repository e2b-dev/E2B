import time
from e2b import Session

watcher = None
def create_watcher(session): # $HighlightLine
  # Start filesystem watcher for the /home directory
  watcher = session.filesystem.watch_dir("/home") # $HighlightLine
  watcher.add_event_listener(lambda event: print(event)) # $HighlightLine
  watcher.start() # $HighlightLine

session = Session.create(id="Nodejs")

create_watcher(session) # $HighlightLine

# Create files in the /home directory inside the playground
# We'll receive notifications for these events through the watcher we created above.
for i in range(10):
  # `filesystem.write()` will trigger two events:
  # 1. 'Create' when the file is created
  # 2. 'Write' when the file is written to
  session.filesystem.write(f"/home/file{i}.txt", f"Hello World {i}!")
  time.sleep(1)

session.close()