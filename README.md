---
- clean up logs. I don't know yet when we should clean up logs
- destroy terminal on subscription error (this might be causing memory leaks and might also be happening with other subscriptions)
- allow re-using an already created terminal subscription
---
# Devbook Daemon

Devbook daemon can run in 2 modes
1. user mode
2. server mode

The server mode is meant to run on Devbook infrastructure for our Devbook VMs. The user mode is intended for users to use together with our Devbook browser extension for terminal.

## Usage

### `server` mode
By default, devbookd starts in the server mode.
```sh
devbookd
```

Optionally, pass the `mode` flag.
```sh
devbookd -mode=server
```

### `user` mode (only macOS supported)
```sh
devbookd -mode=user
```

### `debug` flag
Running in debug mode will print all stdout and stderr to your console.
```sh
devbookd -debug
```

### `version` flag
Running devbookd with the `-version` flag will print the devbookd version to the console.
```sh
devbookd -version
```

## Installation (only macOS supported)
> ❌ Don't use this for installing devbookd on your server!

```sh
curl -L https://install.usedevbook.com/devbookd | sh
```

## Development
To locally test the devbookd:

1. Build the devbookd and start the container with `make test-devbookd` (Use `make test-env` if you want to just build the devbookd, run the container and start the `devbookd` manually later.)
2. Connect to the devbookd with `make connect-wscat`
3. Test the devbookd methods by entering the [services' JSONRPC messages](#services-messages)  to wscat stdin

## Debugging
- https://golangforall.com/en/post/go-docker-delve-remote-debug.html
- https://github.com/golang/vscode-go/blob/master/docs/debugging.md

You can open the pprof for the session's devbookd at `https://8010-$(session-hostname)/debug/pprof/`.

Run `make run-debug` and then connect to the port 2345 with a debugger or
use the VSCode run/debug and run the "Debug in Docker" to build the devbookd, Docker and start the debugging.

## Services' messages
> You need to replace the `terminalID` and `processID` in some JSONRPC messages.

### Process service
Subscribers:
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onStdout", "testing1"], "id": 4}` - Subscibe to process exit
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onStderr", "testing1"], "id": 5}` - Subscibe to process stdout
- `{"jsonrpc": "2.0", "method": "process_subscribe", "params": ["onExit", "testing1"], "id": 6}` - Subscibe to process stderr

Methods:
- `{"jsonrpc": "2.0", "method": "process_start", "params": ["testing1", "tsserver", {}, "/"], "id": 57}` - Start new process
- `{"jsonrpc": "2.0", "method": "process_kill", "params": ["testing1"], "id": 60}` - Kill existing process
- `{"jsonrpc": "2.0", "method": "process_stdin", "params": ["testing1", "test"], "id": 59}` - Send stdin to process

### Code snippet service
Subscribers:
- `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stdout"], "id": 2}` - Subscribe to changes in the stdout from the code snippet
- `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stderr"], "id": 3}` - Subscibe to changes in the stderr from the code snippet
- `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["state"], "id": 4}` - Subscribe to changes in the state of the code snippet execution

Methods:
- `{"jsonrpc": "2.0", "method": "codeSnippet_run", "params": ["echo 1; sleep 2; echo 2; echo 3", {}], "id": 5}` - Run code snippet


### Terminal service
Subscribers:
- `{"jsonrpc": "2.0", "method": "terminal_subscribe", "params": ["onChildProcessesChange", "cblpusiko5ps759fdas0"], "id": 4}` - Subscibe to changes in terminal's child processes

Methods:
- `{"jsonrpc": "2.0", "method": "terminal_start", "params": ["", 100, 80], "id": 5}` - Start a new terminal session
- `{"jsonrpc": "2.0", "method": "terminal_data", "params": ["cblpusiko5ps759fdas0", "sleep 10\n"], "id": 57}` - Execute input in a specified terminal
