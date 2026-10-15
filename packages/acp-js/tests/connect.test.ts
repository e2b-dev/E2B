import { PROTOCOL_VERSION, type Client } from '@agentclientprotocol/sdk'
import { assert } from 'vitest'
import { connectAcpAgent } from '../src'
import { FAKE_AGENT_CMD, uploadFakeAgent } from './fakeAgent'
import { sandboxTest } from './setup'

const client: Client = {
  async requestPermission() {
    return { outcome: { outcome: 'cancelled' } }
  },
  async sessionUpdate() {},
}

sandboxTest('connectAcpAgent connects an ACP client', async ({ sandbox }) => {
  await uploadFakeAgent(sandbox)
  const agent = await connectAcpAgent(sandbox, {
    command: FAKE_AGENT_CMD,
    client,
  })

  const response = await agent.connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: { fs: { readTextFile: true }, terminal: true },
  })

  assert.equal(response.protocolVersion, 1)
  await agent.close()
  assert.equal((await agent.wait()).exitCode, 0)
})
