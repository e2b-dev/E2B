# Development
To locally test the devbookd in the server mode:

1. Build the devbookd and start the container with `make test-devbookd` (Use `make test-env` if you want to just build the devbookd, run the container and start the `devbookd` manually later.)
2. Connect to the devbookd with `make connect-wscat`
3. Test the devbookd methods by entering the [services' JSONRPC messages](#services-messages)  to wscat stdin

## Debugging
- https://golangforall.com/en/post/go-docker-delve-remote-debug.html
- https://github.com/golang/vscode-go/blob/master/docs/debugging.md

You can open the pprof for the session's devbookd at `https://49982-$(session-hostname)/debug/pprof/`.

Run `make run-debug` and then connect to the port 2345 with a debugger or
use the VSCode run/debug and run the "Debug in Docker" to build the devbookd, Docker and start the debugging.

## Services' messages
> You need to replace the `myTerminalID` and `myProcessID` in some JSONRPC messages.

`myProcessID` isn't the actual process ID (pid) of the OS. It's a custom ID you pass to devbookd to make it easier keeping track of processes you want to run.


### Process service
Subscribers:
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onStdout", "myProcessID"], "id": 4}` - Subscibe to process exit
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onStderr", "myProcessID"], "id": 5}` - Subscibe to process stdout
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onExit", "myProcessID"], "id": 6}` - Subscibe to process stderr

Methods:
- `{"jsonrpc": "2.0", "method": "process_start", "params": ["myProcessID", "tsserver", {}, "/"], "id": 57}` - Start new process
- `{"jsonrpc": "2.0", "method": "process_kill", "params": ["myProcessID"], "id": 60}` - Kill existing process
- `{"jsonrpc": "2.0", "method": "process_stdin", "params": ["myProcessID", "test"], "id": 59}` - Send stdin to process

### Code snippet service
Subscribers:
- `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stdout"], "id": 2}` - Subscribe to changes in the stdout from the code snippet
- `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stderr"], "id": 3}` - Subscibe to changes in the stderr from the code snippet
- `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["state"], "id": 4}` - Subscribe to changes in the state of the code snippet execution

Methods:
- `{"jsonrpc": "2.0", "method": "codeSnippet_run", "params": ["echo 1; sleep 2; echo 2; echo 3", {}], "id": 5}` - Run code snippet


### Terminal service
Subscribers:
- `{"jsonrpc": "2.0", "method": "terminal_subscribe", "params": ["onChildProcessesChange", "myTerminalID"], "id": 4}` - Subscibe to changes in terminal's child processes
- `{"jsonrpc": "2.0", "method": "terminal_subscribe", "params": ["onExit", "myTerminalID"], "id": 4}` - Subscibe to terminal process exit

Methods:
- `{"jsonrpc": "2.0", "method": "terminal_start", "params": ["", 100, 80], "id": 5}` - Start a new terminal session
- `{"jsonrpc": "2.0", "method": "terminal_data", "params": ["cblpusiko5ps759fdas0", "sleep 10\n"], "id": 57}` - Execute input in a specified terminal

### Filesystem service
Methods:
- `{"jsonrpc": "2.0", "method": "filesystem_listAllFiles", "params": ["myPath"], "id": 5}` - List all files (and directories) on a specified path
- `{"jsonrpc": "2.0", "method": "filesystem_readFile", "params": ["myPath"], "id": 57}` - Returns content of the file on the specified path
- `{"jsonrpc": "2.0", "method": "filesystem_removeFile", "params": ["myPath"], "id": 57}` - Remove file on the specified path
- `{"jsonrpc": "2.0", "method": "filesystem_writeFile", "params": ["myPath", "myContent"], "id": 57}` - Create or overwrite file on the specified path with the specified content

