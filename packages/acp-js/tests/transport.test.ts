import type { AnyMessage } from '@agentclientprotocol/sdk'
import { assert } from 'vitest'
import { startAcpTransport, type AcpAgentStartOpts } from '../src/transport'
import { FAKE_AGENT_CMD, uploadFakeAgent } from './fakeAgent'
import { sandboxTest } from './setup'

type Message = Record<string, any>

async function startAgent(
  sandbox: Parameters<Parameters<typeof sandboxTest>[1]>[0]['sandbox'],
  opts?: AcpAgentStartOpts
) {
  await uploadFakeAgent(sandbox)
  const agent = await startAcpTransport(sandbox, FAKE_AGENT_CMD, opts)
  const writer = agent.stream.writable.getWriter()
  const reader = agent.stream.readable.getReader()
  const call = async (id: number, method: string, params: unknown = {}) => {
    await writer.write({ jsonrpc: '2.0', id, method, params })
    const { value } = await reader.read()
    return value as Message
  }
  return { agent, writer, reader, call }
}

sandboxTest(
  'initialize reaches the agent without client fs and terminal',
  async ({ sandbox }) => {
    const { agent, call } = await startAgent(sandbox)

    const response = await call(0, 'initialize', {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
      },
    })

    assert.deepEqual(response.result.received.clientCapabilities, {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
    })
    await agent.close()
  }
)

sandboxTest(
  'agent requests for client fs and terminal are rejected in the transport',
  async ({ sandbox }) => {
    const { agent, call } = await startAgent(sandbox)

    for (const [id, method] of [
      [1, 'fs/write_text_file'],
      [2, 'fs/read_text_file'],
      [3, 'terminal/create'],
    ] as const) {
      // The client only sees the agent's final answer, never the request.
      const response = await call(id, 'test/client_call', { method })
      assert.equal(response.id, id)
      assert.equal(response.result.error.code, -32601)
    }

    // Notifications are dropped; the next message is the response.
    const response = await call(4, 'test/notify_client')
    assert.equal(response.result, 'sent')
    await agent.close()
  }
)

sandboxTest(
  'messages split into single bytes are reassembled',
  async ({ sandbox }) => {
    const { agent, call } = await startAgent(sandbox)
    const text = 'Привет 🌍 E2B'

    const response = await call(5, 'test/bytewise', { text })

    assert.equal(response.result, text)
    await agent.close()
  }
)

sandboxTest(
  'invalid agent output gets a parse error and the stream continues',
  async ({ sandbox }) => {
    const { agent, call } = await startAgent(sandbox)

    assert.equal((await call(6, 'test/garbage')).result, 'garbage sent')

    // The agent got a parse error reply, and the stream still works.
    const errors = await call(7, 'test/errors')
    assert.equal(errors.result[0].code, -32700)
    await agent.close()
  }
)

sandboxTest('messages over the limit fail the stream', async ({ sandbox }) => {
  const { agent, writer, reader } = await startAgent(sandbox, {
    maxMessageBytes: 1024,
  })

  await writer.write({
    jsonrpc: '2.0',
    id: 7,
    method: 'test/big',
    params: { size: 4096 },
  })

  let error: unknown
  try {
    await reader.read()
  } catch (err) {
    error = err
  }
  assert.match(String(error), /exceeds the limit of 1024 bytes/)
  await agent.close()
})

sandboxTest(
  'closing the writable sends EOF and ends the stream',
  async ({ sandbox }) => {
    const { agent, writer, reader } = await startAgent(sandbox)

    await writer.close()

    const { done } = await reader.read()
    assert.isTrue(done)
    assert.deepEqual(await agent.wait(), { exitCode: 0, error: undefined })
  }
)

sandboxTest(
  'agent failure errors the stream with its stderr',
  async ({ sandbox }) => {
    let stderr = ''
    const { agent, writer, reader } = await startAgent(sandbox, {
      onStderr: (data) => {
        stderr += data
      },
    })

    await writer.write({
      jsonrpc: '2.0',
      id: 9,
      method: 'test/exit',
      params: { code: 3, stderr: 'boom' },
    } as AnyMessage)

    let error: unknown
    try {
      await reader.read()
    } catch (err) {
      error = err
    }
    assert.match(String(error), /exited with code 3[\s\S]*boom/)
    assert.equal(stderr, 'boom')
    assert.equal((await agent.wait()).exitCode, 3)
  }
)

sandboxTest('cancelling the readable closes the agent', async ({ sandbox }) => {
  const { agent, reader } = await startAgent(sandbox)

  await reader.cancel()

  assert.equal((await agent.wait()).exitCode, 0)
})
