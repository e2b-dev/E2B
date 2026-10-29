# E2B ACP

Run [Agent Client Protocol](https://agentclientprotocol.com) (ACP) agents such as goose, OpenCode or Claude Code inside an [E2B](https://e2b.dev) sandbox, and drive them from your code with the official ACP client.

Source: [packages/acp-js](https://github.com/e2b-dev/E2B/tree/main/packages/acp-js)

## Install

```
npm i e2b @e2b/acp @agentclientprotocol/sdk
```

Set `E2B_API_KEY` to your [E2B API key](https://e2b.dev/dashboard?tab=keys), and the provider key the agent needs.

## Usage

Build your ACP client with `client()` from `@agentclientprotocol/sdk`, create a sandbox from a template with the agent installed, then start the agent and connect the client to it:

```ts
import { Sandbox } from 'e2b'
import { AcpAgent } from '@e2b/acp'
import { client, methods, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'

const app = client({ name: 'my-app' })
  .onRequest(methods.client.session.requestPermission, async ({ params }) => {
    const allow = params.options.find((o) => o.kind === 'allow_once') ?? params.options[0]
    return { outcome: { outcome: 'selected', optionId: allow.optionId } }
  })
  .onNotification(methods.client.session.update, ({ params: { update } }) => {
    if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
      process.stdout.write(update.content.text)
    }
  })

const sandbox = await Sandbox.create('goose', { timeoutMs: 10 * 60_000 })
try {
  const agent = await AcpAgent.start(sandbox, 'goose acp --with-builtin developer', app, {
    envs: {
      GOOSE_PROVIDER: 'openai',
      GOOSE_MODEL: 'gpt-5.6-luna',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    },
  })

  await agent.connection.agent.request(methods.agent.initialize, { protocolVersion: PROTOCOL_VERSION })
  const session = await agent.connection.agent.buildSession('/home/user').start()
  await session.prompt('Create fizzbuzz.py for 1 to 15 and run it.')

  await agent.stop()
} finally {
  await sandbox.kill()
}
```

## Where the agent's tools run

The agent talks ACP over its stdin and stdout. `AcpAgent.start` turns off the client filesystem and terminal capabilities in `initialize` and answers agent requests for `fs/*` or `terminal/*` with an error, so the agent edits files and runs commands with its own tools inside the sandbox. It does not restrict the agent's network access or the MCP servers you pass to it.

## Lifecycle

- `agent.stop()` sends EOF to the agent and kills it if it has not exited within `timeoutMs` (5 seconds by default) of the call. Messages the agent sends after that are not delivered.
- `agent.wait()` resolves with the exit code once the agent exits.
- Closing the connection with `agent.connection.close()` stops the agent the same way.
- If the agent exits with an error, the connection fails with the exit code and the end of the agent's stderr. Pass `onStderr` to receive its logs.
- The agent runs as long as the sandbox does, so set the sandbox timeout for the longest task you expect.
