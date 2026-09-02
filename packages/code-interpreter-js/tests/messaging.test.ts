import { expect, test } from 'vitest'

import { SandboxError } from '../src'
import { extractError } from '../src/messaging'

test('preserves response details and trace ID for server errors', async () => {
  const error = await extractError(
    new Response('R context failed to initialize', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'X-E2B-Trace-ID': 'trace-123' },
    })
  )

  expect(error).toEqual(
    new SandboxError(
      '500 Internal Server Error: R context failed to initialize (trace_id=trace-123)'
    )
  )
})

test('keeps the existing message when a server error has no diagnostics', async () => {
  const error = await extractError(
    new Response('', { status: 500, statusText: 'Internal Server Error' })
  )

  expect(error).toEqual(new SandboxError('500 Internal Server Error'))
})
