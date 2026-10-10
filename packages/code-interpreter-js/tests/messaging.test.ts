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

test('stdout OutputMessage.timestamp reflects backend timestamp, not client clock', async () => {
  const execution = new Execution()
  // A fixed backend-style timestamp that can never equal
  // `new Date().getTime() * 1000` (client microseconds, ~1.7e12 now).
  const backendTimestamp = 1234567890
  const line = JSON.stringify({
    type: 'stdout',
    text: 'hello\n',
    timestamp: backendTimestamp,
  })

  let captured: OutputMessage | undefined
  await parseOutput(execution, line, (out) => {
    captured = out
    return undefined
  })

  expect(captured).toBeDefined()
  // JS should use the backend `msg.timestamp` (Python uses `data["timestamp"]`
  // in e2b_code_interpreter/models.py). Current bug: timestamp is set to
  // `new Date().getTime() * 1000` (client clock, microseconds), ignoring the
  // backend value entirely.
  expect(captured!.timestamp).toBe(backendTimestamp)
})

test('stderr OutputMessage.timestamp reflects backend timestamp, not client clock', async () => {
  const execution = new Execution()
  const backendTimestamp = 9876543210
  const line = JSON.stringify({
    type: 'stderr',
    text: 'boom\n',
    timestamp: backendTimestamp,
  })

  let captured: OutputMessage | undefined
  await parseOutput(execution, line, undefined, (out) => {
    captured = out
    return undefined
  })

  expect(captured).toBeDefined()
  expect(captured!.error).toBe(true)
  expect(captured!.timestamp).toBe(backendTimestamp)
})
