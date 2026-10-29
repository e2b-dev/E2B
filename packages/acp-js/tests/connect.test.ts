import { client, methods, PROTOCOL_VERSION } from '@agentclientprotocol/sdk'
import { assert } from 'vitest'
import { AcpAgent } from '../src'
import { FAKE_AGENT_CMD, uploadFakeAgent } from './fakeAgent'
import { sandboxTest } from './setup'

const app = client().onRequest(
  methods.client.session.requestPermission,
  async () => ({ outcome: { outcome: 'cancelled' } })
)

sandboxTest('AcpAgent.start connects an ACP client', async ({ sandbox }) => {
  await uploadFakeAgent(sandbox)
  const agent = await AcpAgent.start(sandbox, FAKE_AGENT_CMD, app)

  const response = await agent.connection.agent.request(
    methods.agent.initialize,
    {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true }, terminal: true },
    }
  )

  assert.equal(response.protocolVersion, 1)
  await agent.stop()
  assert.equal((await agent.wait()).exitCode, 0)
})
