import { CommandExitError, type CommandStartOpts, type Sandbox } from 'e2b'
import { assert, expect, test, vi } from 'vitest'
import { AcpAgent } from '../src'
import { startAcpTransport, type AcpSandbox } from '../src/transport'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// A command handle driven by the test instead of a sandbox.
function fakeAgent(opts: { closeStdin?: () => Promise<void> } = {}) {
  let callbacks!: Pick<CommandStartOpts, 'onStdout' | 'onStderr'>
  let settle!: { resolve: (r: unknown) => void; reject: (e: unknown) => void }
  const settled = new Promise(
    (resolve, reject) => (settle = { resolve, reject })
  )
  // Like the SDK handle, the exit is seen only after output callbacks return.
  let output: Promise<unknown> = Promise.resolve()
  const exit = settled.finally(() => output)
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
      run: async (_cmd: string, o: CommandStartOpts) => {
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
    emit: (...messages: unknown[]) =>
      (output = Promise.resolve(
        callbacks.onStdout!(
          messages.map((m) => JSON.stringify(m) + '\n').join('')
        )
      )),
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

test('a failed output stream kills the agent', async () => {
  const agent = fakeAgent()
  const transport = await startAcpTransport(agent.sandbox, 'agent')
  const reader = transport.stream.readable.getReader()

  agent.fail(new Error('output stream broke'))

  await expect(reader.read()).rejects.toThrow('output stream broke')
  expect(agent.handle.kill).toHaveBeenCalledOnce()
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

test('close drops later lines of an output chunk already being read', async () => {
  const agent = fakeAgent()
  const transport = await startAcpTransport(agent.sandbox, 'agent')

  for (let i = 0; i < 63; i++) {
    await agent.emit({ jsonrpc: '2.0', method: 'before' })
  }
  // The read queue fills on the first line, so the chunk waits for the client.
  const reading = agent.emit(
    { jsonrpc: '2.0', method: 'before' },
    { jsonrpc: '2.0', method: 'after' }
  )
  await sleep(0)
  await transport.close({ timeoutMs: 10 })
  await reading

  const methods: string[] = []
  const reader = transport.stream.readable.getReader()
  for (let r = await reader.read(); !r.done; r = await reader.read()) {
    methods.push((r.value as { method: string }).method)
  }
  assert.lengthOf(methods, 64)
  assert.notInclude(methods, 'after')
})

test('connect kills the agent when the client factory throws', async () => {
  const agent = fakeAgent()

  await expect(
    AcpAgent.start(agent.sandbox as Sandbox, 'agent', () => {
      throw new Error('no client')
    })
  ).rejects.toThrow('no client')
  expect(agent.handle.kill).toHaveBeenCalledOnce()
})

test('kill lets wait() see the exit while output waits for the client', async () => {
  const agent = fakeAgent()
  const transport = await startAcpTransport(agent.sandbox, 'agent')

  for (let i = 0; i < 63; i++) {
    await agent.emit({ jsonrpc: '2.0', method: 'update' })
  }
  // The read queue is full, so this callback waits for the client.
  agent.emit({ jsonrpc: '2.0', method: 'update' })
  await sleep(0)
  await transport.kill()

  const exited = await Promise.race([
    transport.wait().then(() => true),
    sleep(500).then(() => false),
  ])
  assert.isTrue(exited)
})

test('output over the limit before start returns still closes the agent', async () => {
  const closeStdin = vi.fn(async () => {})
  const agent = fakeAgent({ closeStdin })
  const run = agent.sandbox.commands.run
  agent.sandbox.commands.run = (async (
    cmd: string,
    opts?: CommandStartOpts
  ) => {
    const handle = await run(cmd, opts)
    opts!.onStdout!('x'.repeat(100))
    return handle
  }) as typeof run
  const transport = await startAcpTransport(agent.sandbox, 'agent', {
    maxMessageBytes: 10,
  })

  await expect(transport.stream.readable.getReader().read()).rejects.toThrow(
    /exceeds the limit/
  )
  await sleep(0)
  expect(closeStdin).toHaveBeenCalledOnce()
})
