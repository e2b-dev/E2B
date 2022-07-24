# Devbook Daemon

## Development
To locally test the env (`Bash`):

1. Run `make testenv` to build the Docker env with latest devbookd
2.  Start the container with `docker run -p 127.0.0.1:8010:8010 -it devbookd-testenv /bin/ash`
3. Run `devbookd` in the container that you started in the previous step
4. Connect to the devbookd with `wscat -c ws://localhost:8010/ws`
5. Subscribe to the devbookd methods by entering the following JSONRPC messages to open wscat connection:
    - `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stdout"], "id": 2}` - STDOUT
    - `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["stderr"], "id": 3}` - STDERR
    - `{"jsonrpc": "2.0", "method": "codeSnippet_subscribe", "params": ["state"], "id": 4}` - STATE
6. Execute code by entering the following JSONRPC messages to open wscat connection:
` {"jsonrpc": "2.0", "method": "codeSnippet_run", "params": ["echo 1; sleep 2; echo 2; echo 3", {}], "id": 5}`
