from e2b import Sandbox

sandbox = Sandbox.create(
    template='base',
    metadata={"user_id": "uniqueID"},  # $HighlightLine
)

# Keep the sandbox alive for 60 seconds
sandbox.keep_alive(60)
# You can even close the script

# Later, can be even from another process
# List all running sandboxes
running_sandboxes = Sandbox.list()

# Find the sandbox by metadata
for running_sandbox in running_sandboxes:
    if running_sandbox.metadata.get("user_id", "") == 'uniqueID':
        sandbox = Sandbox.reconnect(running_sandbox.sandbox_id)
else:
    pass
    # Sandbox not found

sandbox.close()
