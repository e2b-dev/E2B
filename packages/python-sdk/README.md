# E2B Python SDK
The E2B Python SDK provides an interface for managing cloud environments for AI agents.

This SDK gives your agent a full cloud development environment that's sandboxed. That means:

- Access to Linux OS
- Using filesystem (create, list, and delete files and dirs)
- Run processes
- Sandboxed - you can run any code
- Access to the internet

These cloud environments are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.

## Installation

```sh
pip install e2b
```

## Usage

### Initialize new cloud environment session
```python
from e2b import Session
# You can use some of the predefined environments by using specific id:
# 'Nodejs', 'Bash', 'Python3', 'Java', 'Go', 'Rust', 'PHP', 'Perl', 'DotNET'
session = Session(id="Nodejs", on_scan_ports=lambda ports: print("Open ports", ports))

# Start a session and create a connection to it
await session.open()

...

# Close the session after you are done
await session.close()
```

### Use filesystem inside cloud environment
```python
# List
dir_b_content = await session.filesystem.list("/dirA/dirB")

# Write
# This will create a new file "file.txt" inside the dir "dirB" with the content "Hello world".
await session.filesystem.write("/dirA/dirB/file.txt", "Hello World")

# Read
file_content = await session.filesystem.read("/dirA/dirB/file.txt")

# Remove
# Remove a file.
await session.filesystem.remove("/dirA/dirB/file.txt")
# Remove a directory and all of its content.
await session.filesystem.remove("/dirA")

# Make dir
# Creates a new directory "dirC" and also "dirA" and "dirB" if those directories don"t already exist.
await session.filesystem.make_dir("/dirA/dirB/dirC")

# Watch dir for changes
watcher = session.filesystem.watch_dir("/dirA/dirB")
watcher.add_event_listener(lambda e: print("Event", e))
await watcher.start()
```

### Start process inside cloud environment
```python
proc = await session.process.start(
  cmd="echo Hello World",
  on_stdout=on_stdout,
  on_stderr=on_stderr,
  on_exit=lambda: print("Exit"),
  rootdir="/code",
)

await proc.send_stdin("\n")

print(proc.process_id)

await proc.kill()

# Wait for process to finish
await proc.finished
```

### Create interactive terminal inside cloud environment
```python
term = await session.terminal.start(
    on_data=lambda data: print("Data", data),
    on_exit=lambda: print("Exit"),
    cols=80,
    rows=24,
    rootdir="/code",
    # If you specify a command, the terminal will be closed after the command finishes.
    # cmd="echo Hello World",
)

await term.send_data("echo 1\n")

await term.resize(80, 30)

print(term.terminal_id)

await term.kill()
```

### Get public hostname for an exposed port inside cloud environment
```python
# Get hostname for port 3000. The hostname is without the protocol (http://).
hostname = session.get_hostname(3000)
```
