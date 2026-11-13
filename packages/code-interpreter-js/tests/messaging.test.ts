import { expect, test } from 'vitest'

import { SandboxError } from '../src'
import {
  Execution,
  OutputMessage,
  extractError,
  parseOutput,
} from '../src/messaging'

test('includes the response body in server errors', async () => {
  const error = await extractError(
    new Response('  R context failed to initialize  ', {
      status: 500,
      statusText: 'Internal Server Error',
    })
  )

  expect(error).toEqual(
    new SandboxError(
      '500 Internal Server Error: R context failed to initialize'
    )
  )
})

test('falls back to the status text for an empty body', async () => {
  const error = await extractError(
    new Response('', { status: 500, statusText: 'Internal Server Error' })
  )

  expect(error).toEqual(new SandboxError('500 Internal Server Error'))
})

test('stdout output carries the backend timestamp, not the client clock', async () => {
  const backendTimestamp = '1762095600123456789'
  const execution = new Execution()
  let received: OutputMessage | undefined

  await parseOutput(
    execution,
    `{"type":"stdout","text":"hello","timestamp":${backendTimestamp}}`,
    (msg) => {
      received = msg
    }
  )

  expect(received?.timestamp).toBe(Number(backendTimestamp))
  expect(received?.error).toBe(false)
})

test('stderr output carries the backend timestamp, not the client clock', async () => {
  const backendTimestamp = '1762095600123456789'
  const execution = new Execution()
  let received: OutputMessage | undefined

  await parseOutput(
    execution,
    `{"type":"stderr","text":"boom","timestamp":${backendTimestamp}}`,
    undefined,
    (msg) => {
      received = msg
    }
  )

  expect(received?.timestamp).toBe(Number(backendTimestamp))
  expect(received?.error).toBe(true)
})

test('backend nanosecond timestamps are rounded to the nearest representable number', async () => {
  const timestamps: number[] = []

  for (const ts of ['1762095600123456789', '1762095600123456790']) {
    await parseOutput(
      new Execution(),
      `{"type":"stdout","text":"x","timestamp":${ts}}`,
      (msg) => {
        timestamps.push(msg.timestamp)
      }
    )
  }

  expect(timestamps[0]).toBe(timestamps[1])
  const drift = BigInt(timestamps[0]) - 1762095600123456789n
  expect(drift >= -128n && drift <= 128n).toBe(true)
})
