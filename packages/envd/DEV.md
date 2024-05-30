# Development
To locally test the envd in the server mode:

1. Build the envd and start the container with `make build-docker && make start-debug-docker` (Use `make build-debug-race` if you want to just build the envd, run the container and start the `envd` manually later.)

## Debugging
- https://golangforall.com/en/post/go-docker-delve-remote-debug.html
- https://github.com/golang/vscode-go/blob/master/docs/debugging.md

You can open the pprof for the session's envd at `https://49982-$(session-hostname)/debug/pprof/`.

Run `make run-debug` and then connect to the port 2345 with a debugger or
use the VSCode run/debug and run the "Debug in Docker" to build the envd, Docker and start the debugging.
