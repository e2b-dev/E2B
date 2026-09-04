import { expect, test, vi } from 'vitest'

import { NotFoundError, SandboxError, TimeoutError } from '../src'
import { extractError } from '../src/messaging'

test('preserves response details and trace ID for CI server errors', async () => {
  const error = await extractError(
    new Response('R context failed to initialize', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'X-E2B-Trace-ID': 'trace-123' },
    }),
    true
  )

  expect(error).toEqual(
    new SandboxError(
      '500 Internal Server Error: R context failed to initialize (trace_id=trace-123)'
    )
  )
})

test('keeps the existing message outside CI even when diagnostics are available', async () => {
  const response = new Response('R context failed to initialize', {
    status: 500,
    statusText: 'Internal Server Error',
    headers: { 'X-E2B-Trace-ID': 'trace-123' },
  })
  const text = vi.spyOn(response, 'text')

  const error = await extractError(response, false)

  expect(error).toEqual(new SandboxError('500 Internal Server Error'))
  expect(text).not.toHaveBeenCalled()
})

test.each([
  [404, '  missing  ', NotFoundError, '  missing  '],
  [
    502,
    '  timed out  ',
    TimeoutError,
    "  timed out  : This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.",
  ],
])(
  'preserves the non-CI %s response body exactly',
  async (status, body, ErrorClass, message) => {
    const error = await extractError(new Response(body, { status }), false)

    expect(error).toEqual(new ErrorClass(message))
  }
)
