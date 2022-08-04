# Devbook Daemon

## Development
To locally test the env (`Bash` template):

1. Run `make testenv` to build the Docker env with latest devbookd
2.  Start the container with `docker run -p 127.0.0.1:8010:8010 -it devbookd-testenv /bin/ash`
3. Run `devbookd` in the container that you started in the previous step
4. Install `wscat` with `npm i -g wscat`
5. Connect to the devbookd with `wscat -c ws://localhost:8010/ws`
6. Subscribe to the devbookd methods by entering the following JSONRPC messages to open wscat connection:
    - `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stdout"], "id": 2}` - Subscribe to changes in the stdout from the code snippet
    - `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stderr"], "id": 3}` - Subscibe to changes in the stderr from the code snippet
    - `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["state"], "id": 4}` - Subscribe to changes in the state of the code snippet execution
    - `{"jsonrpc": "2.0", "method": "terminal_subscribe", "params": ["onChildProcessesChange", "cblpusiko5ps759fdas0"], "id": 4}` - Subscibe to changes in terminal's child processes
7. Execute code by entering the following JSONRPC messages to open wscat connection:
    - `{"jsonrpc": "2.0", "method": "codeSnippet_run", "params": ["echo 1; sleep 2; echo 2; echo 3", {}], "id": 5}` - Run code snippet
    - `{"jsonrpc": "2.0", "method": "terminal_start", "params": ["", 100, 80], "id": 5}` - Start a new terminal session
    - `{"jsonrpc": "2.0", "method": "terminal_data", "params": ["cblpusiko5ps759fdas0", "sleep 10\n"], "id": 57}` - Execute input in a specified terminal

> You need to replace the `terminalID` in some JSONRPC messages.
