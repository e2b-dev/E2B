import { expect, test } from 'vitest'

import { SandboxError } from '../src'
import { extractError } from '../src/messaging'

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
