import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { setupServer } from 'msw/node'

import { InvalidArgumentError, Template } from '../../src'
import { TEST_API_KEY } from '../setup'

// A name that is empty or a dot segment does not stay in its place in the
// request path: `/templates/aliases/..` is the template list. It is refused
// before a request is sent.

const requests: string[] = []
const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  server.events.on('request:start', ({ request }) => {
    requests.push(`${request.method} ${new URL(request.url).pathname}`)
  })
})

afterAll(() => server.close())

afterEach(() => {
  requests.length = 0
})

const opts = { apiKey: TEST_API_KEY }

describe.each<[string, (name: string) => Promise<unknown>]>([
  ['exists', (name) => Template.exists(name, opts)],
  ['aliasExists', (name) => Template.aliasExists(name, opts)],
  ['getTags', (name) => Template.getTags(name, opts)],
  ['delete', (name) => Template.delete(name, opts)],
  [
    'getBuildStatus',
    (name) =>
      Template.getBuildStatus({ templateId: name, buildId: 'b1' }, opts),
  ],
])('Template.%s', (_, call) => {
  test.each(['', '.', '..'])('refuses the name %j', async (name) => {
    await expect(call(name)).rejects.toThrow(InvalidArgumentError)
    expect(requests).toEqual([])
  })
})
