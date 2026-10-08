# Code Interpreter HTTP tests

Run the commands below from `packages/code-interpreter-template/tests`.

End-to-end tests for the Code Interpreter template. Sandboxes are created with
the `e2b` SDK from `E2B_TESTS_TEMPLATE` (defaults to `code-interpreter-v1`);
everything else talks to the server's HTTP API on port `49999` directly with
`httpx`, so the server protocol is what's under test, not the SDK. See
`.env.example` for configuration.

```bash
uv sync --locked
E2B_API_KEY=... uv run pytest
```

Set `E2B_DEBUG=true` to run against a local server started with
`make -C .. start-template-server`; tests marked `skip_debug` (sandbox provisioning,
optional kernels, recovery) are skipped in that mode.

A few checks need a shell inside the sandbox (systemd restarts, the private
Jupyter Unix socket in `test_jupyter_socket.py`); those use the SDK's
`sandbox.commands.run` and are otherwise asserted the same way.
