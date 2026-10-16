import { CommandExitError, type CommandStartOpts, type Sandbox } from 'e2b'
import { assert, expect, test, vi } from 'vitest'
import { connectAcpAgent } from '../src'
import { startAcpTransport, type AcpSandbox } from '../src/transport'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// A command handle driven by the test instead of a sandbox.
function fakeAgent(opts: { closeStdin?: () => Promise<void> } = {}) {
  let callbacks!: Pick<CommandStartOpts, 'onStdout' | 'onStderr'>
  let settle!: { resolve: (r: unknown) => void; reject: (e: unknown) => void }
  const exit = new Promise((resolve, reject) => (settle = { resolve, reject }))
  exit.catch(() => {})

  const writes: string[] = []
  let active = 0
  let maxActive = 0
  const exitWith = (exitCode: number) => {
    const result = { exitCode, stdout: '', stderr: '' }
    if (exitCode === 0) settle.resolve(result)
    else settle.reject(new CommandExitError(result))
  }
  const handle = {
    pid: 42,
    sendStdin: async (data: string) => {
      active++
      maxActive = Math.max(maxActive, active)
      await sleep(2)
      writes.push(data)
      active--
    },
    closeStdin: opts.closeStdin ?? (async () => {}),
    kill: vi.fn(async () => {
      exitWith(-1)
      return true
    }),
    wait: () => exit,
  }
  const sandbox = {
    commands: {
      supportsStdinClose: true,
      startStreaming: async (_cmd: string, o: CommandStartOpts) => {
        callbacks = o
        return handle
      },
    },
  } as unknown as AcpSandbox

  return {
    sandbox,
    handle,
    writes,
    maxActive: () => maxActive,
    emit: (message: unknown) =>
      callbacks.onStdout!(JSON.stringify(message) + '\n'),
    exitWith,
    fail: (err: unknown) => settle.reject(err),
  }
}

test('client writes and transport replies never overlap', async () => {
  const agent = fakeAgent()
  const transport = await startAcpTransport(agent.sandbox, 'agent')
  const writer = transport.stream.writable.getWriter()

  const pending = []
  for (let i = 0; i < 10; i++) {
    pending.push(writer.write({ jsonrpc: '2.0', id: i, method: 'echo' }))
    // Each forbidden request makes the transport write a reply itself.
    pending.push(
      agent.emit({ jsonrpc: '2.0', id: `fs-${i}`, method: 'fs/read_text_file' })
    )
  }
  await Promise.all(pending)
  await writer.ready
  await sleep(50)

  assert.equal(agent.writes.length, 20)
  assert.equal(agent.maxActive(), 1)
})

test('graceful EOF still reports a failed exit', async () => {
  const agent = fakeAgent()
  const transport = await startAcpTransport(agent.sandbox, 'agent')
  const reader = transport.stream.readable.getReader()

  await transport.stream.writable.getWriter().close()
  agent.exitWith(3)

  await expect(reader.read()).rejects.toThrow(/exited with code 3/)
})

test('graceful EOF surfaces a failure to close stdin', async () => {
  const agent = fakeAgent({
    closeStdin: async () => {
      throw new Error('stdin gone')
    },
  })
  const transport = await startAcpTransport(agent.sandbox, 'agent')

  await expect(transport.stream.writable.getWriter().close()).rejects.toThrow(
    'stdin gone'
  )
})

test('close kills the agent when its output stream failed', async () => {
  // EOF goes through, but the process is still running.
  const agent = fakeAgent()
  const transport = await startAcpTransport(agent.sandbox, 'agent')

  agent.fail(new Error('output stream broke'))
  await expect(transport.wait()).rejects.toThrow('output stream broke')
  await transport.close({ timeoutMs: 50 })

  expect(agent.handle.kill).toHaveBeenCalled()
})

test('close timeout covers a hung EOF and then kills', async () => {
  const agent = fakeAgent({ closeStdin: () => new Promise(() => {}) })
  const transport = await startAcpTransport(agent.sandbox, 'agent')

  const started = Date.now()
  await transport.close({ timeoutMs: 50 })

  assert.isBelow(Date.now() - started, 1_000)
  expect(agent.handle.kill).toHaveBeenCalledOnce()
})

test('close rejects when the agent could not be killed', async () => {
  const agent = fakeAgent({ closeStdin: () => new Promise(() => {}) })
  agent.handle.kill.mockRejectedValueOnce(new Error('kill failed'))
  const transport = await startAcpTransport(agent.sandbox, 'agent')

  await expect(transport.close({ timeoutMs: 50 })).rejects.toThrow(
    'kill failed'
  )
})

test('close keeps buffered messages and drops later ones', async () => {
  const agent = fakeAgent()
  const transport = await startAcpTransport(agent.sandbox, 'agent')
  const reader = transport.stream.readable.getReader()

  await agent.emit({ jsonrpc: '2.0', method: 'before' })
  const closing = transport.close({ timeoutMs: 50 })
  await agent.emit({ jsonrpc: '2.0', method: 'after' })
  agent.exitWith(0)
  await closing

  assert.equal(
    ((await reader.read()).value as { method: string }).method,
    'before'
  )
  assert.isTrue((await reader.read()).done)
})

test('connect kills the agent when the client factory throws', async () => {
  const agent = fakeAgent()

  await expect(
    connectAcpAgent(agent.sandbox as Sandbox, {
      command: 'agent',
      client: () => {
        throw new Error('no client')
      },
    })
  ).rejects.toThrow('no client')
  expect(agent.handle.kill).toHaveBeenCalledOnce()
})
