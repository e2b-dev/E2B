import { assert, expect, test, describe } from 'vitest'
import { Code, ConnectError } from '@connectrpc/connect'
import {
  handleProcessStartEvent,
  handleWatchDirStartEvent,
} from '../../src/envd/api'
import { SandboxError } from '../../src/errors'

async function* fromEvents<T>(...events: T[]): AsyncGenerator<T> {
  for (const event of events) {
    yield event
  }
}

// eslint-disable-next-line require-yield
async function* throwing<T>(err: unknown): AsyncGenerator<T> {
  throw err
}

describe('handleProcessStartEvent', () => {
  test('returns the pid from a start event', async () => {
    const pid = await handleProcessStartEvent(
      fromEvents({
        event: { event: { case: 'start', value: { pid: 42 } } },
      }) as any
    )
    assert.strictEqual(pid, 42)
  })

  test('throws "Expected start event" when the stream yields no events', async () => {
    await expect(handleProcessStartEvent(fromEvents() as any)).rejects.toThrow(
      'Expected start event'
    )
  })

  test('throws "Expected start event" for a non-start event', async () => {
    await expect(
      handleProcessStartEvent(
        fromEvents({ event: { event: { case: 'data', value: {} } } }) as any
      )
    ).rejects.toThrow('Expected start event')
  })

  test('maps a ConnectError(Unavailable) to a SandboxError', async () => {
    await expect(
      handleProcessStartEvent(
        throwing(new ConnectError('gone', Code.Unavailable)) as any
      )
    ).rejects.toBeInstanceOf(SandboxError)
  })
})

describe('handleWatchDirStartEvent', () => {
  test('returns the start value from a start event', async () => {
    const value = await handleWatchDirStartEvent(
      fromEvents({ event: { case: 'start', value: { foo: 'bar' } } }) as any
    )
    assert.deepEqual(value, { foo: 'bar' })
  })

  test('throws "Expected start event" when the stream yields no events', async () => {
    await expect(handleWatchDirStartEvent(fromEvents() as any)).rejects.toThrow(
      'Expected start event'
    )
  })

  test('throws "Expected start event" for a non-start event', async () => {
    await expect(
      handleWatchDirStartEvent(
        fromEvents({ event: { case: 'filesystem', value: {} } }) as any
      )
    ).rejects.toThrow('Expected start event')
  })

  test('maps a ConnectError(Unavailable) to a SandboxError', async () => {
    await expect(
      handleWatchDirStartEvent(
        throwing(new ConnectError('gone', Code.Unavailable)) as any
      )
    ).rejects.toBeInstanceOf(SandboxError)
  })
})
