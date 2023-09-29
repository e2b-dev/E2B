# Development
To locally test the envd in the server mode:

1. Build the envd and start the container with `make build-docker && make start-debug-docker` (Use `make build-debug-race` if you want to just build the envd, run the container and start the `envd` manually later.)
2. Connect to the envd with `make connect-wscat`
3. Test the envd methods by entering the [services' JSONRPC messages](#services-messages)  to wscat stdin

## Debugging
- https://golangforall.com/en/post/go-docker-delve-remote-debug.html
- https://github.com/golang/vscode-go/blob/master/docs/debugging.md

You can open the pprof for the session's envd at `https://49982-$(session-hostname)/debug/pprof/`.

Run `make run-debug` and then connect to the port 2345 with a debugger or
use the VSCode run/debug and run the "Debug in Docker" to build the envd, Docker and start the debugging.

## Services' messages
> You need to replace the `myTerminalID` and `myProcessID` in some JSONRPC messages.

`myProcessID` isn't the actual process ID (pid) of the OS. It's a custom ID you pass to envd to make it easier keeping track of processes you want to run.

### Process service
Subscribers:
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onStdout", "myProcessID"], "id": 4}` - Subscibe to process exit
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onStderr", "myProcessID"], "id": 5}` - Subscibe to process stdout
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onExit", "myProcessID"], "id": 6}` - Subscibe to process stderr

Methods:
- `{"jsonrpc": "2.0", "method": "process_start", "params": ["myProcessID", "tsserver", {}, "/"], "id": 57}` - Start new process
- `{"jsonrpc": "2.0", "method": "process_kill", "params": ["myProcessID"], "id": 60}` - Kill existing process
- `{"jsonrpc": "2.0", "method": "process_stdin", "params": ["myProcessID", "test"], "id": 59}` - Send stdin to process


### Terminal service
Subscribers:
- `{"jsonrpc": "2.0", "method": "terminal_subscribe", "params": ["onChildProcessesChange", "myTerminalID"], "id": 4}` - Subscibe to changes in terminal's child processes
- `{"jsonrpc": "2.0", "method": "terminal_subscribe", "params": ["onExit", "myTerminalID"], "id": 4}` - Subscibe to terminal process exit

Methods:
- `{"jsonrpc": "2.0", "method": "terminal_start", "params": ["", 100, 80], "id": 5}` - Start a new terminal session
- `{"jsonrpc": "2.0", "method": "terminal_data", "params": ["cblpusiko5ps759fdas0", "sleep 10\n"], "id": 57}` - Execute input in a specified terminal


### Filesystem service
Subscribers:
- `{"jsonrpc": "2.0", "method": "filesystem_watchDir", "params": ["/dirA/dirB"], "id": 4}` - Subscribe to filesystem events on a directory path. Trying to watch a nonexisting directory will result in error.

Methods:
- `{"jsonrpc": "2.0", "method": "filesystem_list", "params": ["/dirA/dirB"], "id": 5}` - List all files (and directories) on a specified path
- `{"jsonrpc": "2.0", "method": "filesystem_read" "params": ["/dirA/dirB/file.txt"], "id": 57}` - Return content of the file on the specified path
- `{"jsonrpc": "2.0", "method": "filesystem_remove", "params": ["/dirA/dirB"], "id": 57}` - Remove a file or a directory on the specified path
- `{"jsonrpc": "2.0", "method": "filesystem_write", "params": ["/dirA/dirB/file.txt", "myContent"], "id": 57}` - Create or overwrite file on the specified path with the specified content

- `{"jsonrpc": "2.0", "method": "filesystem_makeDir", "params": ["/dirA/dirB/dirC"], "id": 57}` - Create or overwrite file on the specified path with the specified content
