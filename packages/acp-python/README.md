# E2B ACP

Run [Agent Client Protocol](https://agentclientprotocol.com) (ACP) agents such as goose, OpenCode or Claude Code inside an [E2B](https://e2b.dev) sandbox, and drive them from your code with the official ACP client.

Source: [packages/acp-python](https://github.com/e2b-dev/E2B/tree/main/packages/acp-python)

## Install

```
pip install e2b e2b-acp agent-client-protocol
```

Set `E2B_API_KEY` to your [E2B API key](https://e2b.dev/dashboard?tab=keys), and the provider key the agent needs.

## Usage

Create a sandbox from a template with the agent installed, then start the agent and connect your ACP client to it. The ACP Python SDK is asynchronous, so use `AsyncSandbox`.

```python
import asyncio
import os

import acp
from acp import schema
from e2b import AsyncSandbox
from e2b_acp import connect_acp_agent


class Client:
    async def request_permission(self, session_id, tool_call, options, **kwargs):
        allow = next((o for o in options if o.kind == "allow_once"), options[0])
        return schema.RequestPermissionResponse(
            outcome=schema.AllowedOutcome(outcome="selected", option_id=allow.option_id)
        )

    async def session_update(self, session_id, update, **kwargs):
        if isinstance(update, schema.AgentMessageChunk) and update.content.type == "text":
            print(update.content.text, end="")


async def main():
    sandbox = await AsyncSandbox.create("goose", timeout=600)
    try:
        agent = await connect_acp_agent(
            sandbox,
            "goose acp --with-builtin developer",
            Client(),
            envs={
                "GOOSE_PROVIDER": "openai",
                "GOOSE_MODEL": "gpt-5.6-luna",
                "OPENAI_API_KEY": os.environ["OPENAI_API_KEY"],
            },
        )
        await agent.connection.initialize(protocol_version=acp.PROTOCOL_VERSION)
        session = await agent.connection.new_session(cwd="/home/user", mcp_servers=[])
        await agent.connection.prompt(
            session_id=session.session_id,
            prompt=[acp.text_block("Create fizzbuzz.py for 1 to 15 and run it.")],
        )
        await agent.close()
    finally:
        await sandbox.kill()


asyncio.run(main())
```

## Where the agent's tools run

The agent talks ACP over its stdin and stdout. `connect_acp_agent` turns off the client filesystem and terminal capabilities in `initialize` and answers agent requests for `fs/*` or `terminal/*` with an error, so the agent edits files and runs commands with its own tools inside the sandbox. It does not restrict the agent's network access or the MCP servers you pass to it.

## Lifecycle

- `agent.close()` sends EOF to the agent and kills it if it has not exited within `timeout` (5 seconds by default) of the call. Messages the agent sends after that are not delivered.
- `agent.wait()` returns the exit code once the agent exits.
- If the agent exits, pending requests on the connection fail with a connection error. Use `agent.wait()` for the exit code and pass `on_stderr` to receive the agent's logs.
- The agent runs as long as the sandbox does, so set the sandbox timeout for the longest task you expect.
