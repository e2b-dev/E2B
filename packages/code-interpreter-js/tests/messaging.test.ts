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
  const backendTimestamp = 1700000000000000000
  const execution = new Execution()
  let received: OutputMessage | undefined

  await parseOutput(
    execution,
    JSON.stringify({
      type: 'stdout',
      text: 'hello',
      timestamp: backendTimestamp,
    }),
    (msg) => {
      received = msg
    }
  )

  expect(received?.timestamp).toBe(backendTimestamp)
  expect(received?.error).toBe(false)
})

test('stderr output carries the backend timestamp, not the client clock', async () => {
  const backendTimestamp = 1700000000000000000
  const execution = new Execution()
  let received: OutputMessage | undefined

  await parseOutput(
    execution,
    JSON.stringify({
      type: 'stderr',
      text: 'boom',
      timestamp: backendTimestamp,
    }),
    undefined,
    (msg) => {
      received = msg
    }
  )

  expect(received?.timestamp).toBe(backendTimestamp)
  expect(received?.error).toBe(true)
})
