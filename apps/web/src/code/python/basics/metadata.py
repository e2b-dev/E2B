from e2b import Sandbox, SandboxState
from e2b.sandbox.sandbox_api import SandboxQuery

sandbox = Sandbox(
    template="base",
    metadata={"user_id": "uniqueID"},  # $HighlightLine
)

# Keep the sandbox alive for 60 seconds
sandbox.set_timeout(60)
# You can even close the script

# Later, can be even from another process
# List all running sandboxes
paginator = Sandbox.list(query=SandboxQuery(state=[SandboxState.RUNNING]))
running_sandboxes = paginator.next_items()

# Find the sandbox by metadata
for running_sandbox in running_sandboxes:
    if running_sandbox.metadata.get("user_id", "") == "uniqueID":
        sandbox = Sandbox.connect(running_sandbox.sandbox_id)
        break
else:
    # Sandbox not found
    pass

sandbox.close()
