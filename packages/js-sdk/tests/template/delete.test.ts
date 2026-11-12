import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Sandbox, Template, TemplateError } from '../../src'
import { apiUrl, TEST_API_KEY } from '../setup'

const deletedPaths: string[] = []

const server = setupServer(
  http.delete(apiUrl('/templates/:templateID'), ({ request, params }) => {
    deletedPaths.push(new URL(request.url).pathname)
    switch (params.templateID) {
      case 'missing':
        return HttpResponse.json(
          { code: 404, message: 'Template not found' },
          { status: 404 }
        )
      case 'broken':
        return HttpResponse.json(
          { code: 500, message: 'Internal error' },
          { status: 500 }
        )
      default:
        return new HttpResponse(null, { status: 204 })
    }
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  deletedPaths.length = 0
  server.resetHandlers()
})

test('returns true when the template is deleted', async () => {
  await expect(
    Template.delete('my-template', { apiKey: TEST_API_KEY })
  ).resolves.toBe(true)
  expect(deletedPaths).toEqual(['/templates/my-template'])
})

test('encodes a namespaced name in the path', async () => {
  await Template.delete('my-team/my-template', { apiKey: TEST_API_KEY })
  expect(deletedPaths).toEqual(['/templates/my-team%2Fmy-template'])
})

test('returns false when the template is not found', async () => {
  await expect(
    Template.delete('missing', { apiKey: TEST_API_KEY })
  ).resolves.toBe(false)
})

test('throws a TemplateError on other failures', async () => {
  await expect(
    Template.delete('broken', { apiKey: TEST_API_KEY })
  ).rejects.toBeInstanceOf(TemplateError)
})

test('Sandbox.deleteSnapshot delegates to the same endpoint', async () => {
  await expect(
    Sandbox.deleteSnapshot('snapshot-id', { apiKey: TEST_API_KEY })
  ).resolves.toBe(true)
  await expect(
    Sandbox.deleteSnapshot('missing', { apiKey: TEST_API_KEY })
  ).resolves.toBe(false)
  expect(deletedPaths).toEqual(['/templates/snapshot-id', '/templates/missing'])
})
