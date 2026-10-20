import type { Client } from '@connectrpc/connect'
import { expect, test } from 'vitest'

import { Process as ProcessService } from '../../../src/envd/process/process_pb'
import { CommandInputHandle } from '../../../src/sandbox/commands/inputHandle'

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
