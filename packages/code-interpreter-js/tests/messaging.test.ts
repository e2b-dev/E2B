import { expect, test } from 'vitest'

import { SandboxError } from '../src'
import { extractError } from '../src/messaging'
import { Result } from '../src/messaging'

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

test('Result.toJSON includes data field when present', () => {
  const result = new Result(
    {
      text: 'table',
      data: { columns: ['answer'], rows: [[42]] },
    },
    true
  )

  const json = result.toJSON()
  expect(json).toHaveProperty('data')
  expect(json.data).toEqual({ columns: ['answer'], rows: [[42]] })
})

test('Result.toJSON includes empty data field', () => {
  const result = new Result(
    {
      text: 'table',
      data: {},
    },
    true
  )

  const json = result.toJSON()
  expect(json).toHaveProperty('data')
  expect(json.data).toEqual({})
})

test('Result.toJSON omits data field when undefined', () => {
  const result = new Result(
    {
      text: 'table',
    },
    true
  )

  const json = result.toJSON()
  expect(json).not.toHaveProperty('data')
})
