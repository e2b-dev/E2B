import time
from e2b import Sandbox


sandbox = Sandbox('base')

# Do something in the sandbox
sandbox.filesystem.write('hello.txt', 'Hello World!')

# Get the sandbox ID, we'll need it later
sandboxID = sandbox.id

# Keep alive the sandbox for 2 minutes
sandbox.keep_alive(2 * 60)  # $HighlightLine

# Close the sandbox
sandbox.close()

# Do something else...
time.sleep(60)

# Reconnect to the sandbox
sandbox2 = Sandbox.reconnect(sandboxID) # $HighlightLine

# Continue in using the sandbox
content = sandbox2.filesystem.read('hello.txt')
print(content)

# Close the sandbox
sandbox2.close()
