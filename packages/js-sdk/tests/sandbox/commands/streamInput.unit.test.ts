import type { Client } from '@connectrpc/connect'
import { Code, ConnectError } from '@connectrpc/connect'
import { expect, test } from 'vitest'

import { Process as ProcessService } from '../../../src/envd/process/process_pb'
import { SandboxNotRunningError } from '../../../src/errors'
import { CommandInputHandle } from '../../../src/sandbox/commands/inputHandle'

test.each(['stdin', 'pty'] as const)(
  'stream input rejects new %s data while diagnosing a failed stream',
  async (kind) => {
    const healthStarted = Promise.withResolvers<void>()
    const healthResult = Promise.withResolvers<boolean>()
    const rpc = {
      async streamInput() {
        throw new ConnectError('terminated', Code.Unknown)
      },
    } as unknown as Client<typeof ProcessService>
    const input = new CommandInputHandle(rpc, 42, kind, {}, () => {
      healthStarted.resolve()
      return healthResult.promise
    })

    await healthStarted.promise
    const send = input.send('late')
    healthResult.resolve(false)

    await Promise.all([
      expect(send).rejects.toBeInstanceOf(SandboxNotRunningError),
      expect(input.close()).rejects.toBeInstanceOf(SandboxNotRunningError),
    ])
  }
)

test('stream input preserves order and sends keepalives while idle', async () => {
  const messages: any[] = []
  let resolveStarted!: () => void
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve
  })
  const rpc = {
    async streamInput(requests: AsyncIterable<any>) {
      for await (const request of requests) {
        messages.push(request)
        if (request.event.case === 'start') {
          resolveStarted()
        }
      }
      return {}
    },
  } as unknown as Client<typeof ProcessService>

  const input = new CommandInputHandle(
    rpc,
    42,
    'stdin',
    {},
    async () => true,
    50
  )

  await started
  await input.send('a')
  await input.send(new TextEncoder().encode('b'))
  await new Promise((resolve) => setTimeout(resolve, 125))
  await input.send('c')
  await input.close()

  const events = messages.map((message) => message.event.case)
  const firstDataIndex = events.indexOf('data')
  const lastDataIndex = events.lastIndexOf('data')
  const keepaliveIndex = events.indexOf('keepalive')
  const data = messages
    .filter((message) => message.event.case === 'data')
    .map((message) =>
      new TextDecoder().decode(message.event.value.input.input.value)
    )

  expect(events[0]).toBe('start')
  expect(
    events.filter((event) => event === 'keepalive').length
  ).toBeGreaterThan(0)
  expect(keepaliveIndex).toBeGreaterThan(firstDataIndex)
  expect(keepaliveIndex).toBeLessThan(lastDataIndex)
  expect(data).toEqual(['a', 'b', 'c'])
  await expect(input.send('late')).rejects.toThrow(
    'sandbox.commands.streamInput(pid)` or `sandbox.pty.streamInput(pid)'
  )
})

test('stream input snapshots mutable byte arrays when enqueued', async () => {
  const messages: any[] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const rpc = {
    async streamInput(requests: AsyncIterable<any>) {
      await gate
      for await (const request of requests) {
        messages.push(request)
      }
      return {}
    },
  } as unknown as Client<typeof ProcessService>

  const input = new CommandInputHandle(
    rpc,
    42,
    'stdin',
    {},
    async () => true,
    50
  )
  const buffer = new TextEncoder().encode('a')

  await input.send(buffer)
  buffer.set(new TextEncoder().encode('b'))
  release()
  await input.close()

  const data = messages
    .filter((message) => message.event.case === 'data')
    .map((message) =>
      new TextDecoder().decode(message.event.value.input.input.value)
    )
  expect(data).toEqual(['a'])
})
