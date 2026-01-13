import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'

// Mock handlers for tag API endpoints
const mockHandlers = [
  http.post('https://api.e2b.app/templates/tags', async ({ request }) => {
    const { names } = (await request.clone().json()) as {
      names: string[]
    }
    return HttpResponse.json({
      buildID: 'mock-build-id',
      tags: names,
    })
  }),
  http.delete('https://api.e2b.app/templates/tags/:name', ({ params }) => {
    const { name } = params
    if (name === 'nonexistent:tag') {
      return HttpResponse.json({ message: 'Tag not found' }, { status: 404 })
    }
    return new HttpResponse(null, { status: 204 })
  }),
]

const server = setupServer(...mockHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

describe('Template.assignTag', () => {
  test('assigns a single tag', async () => {
    const result = await Template.assignTag(
      'my-template:v1.0',
      'my-template:production'
    )
    expect(result.buildId).toBe('mock-build-id')
    expect(result.tags).toContain('my-template:production')
  })

  test('assigns multiple tags', async () => {
    const result = await Template.assignTag('my-template:v1.0', [
      'my-template:production',
      'my-template:stable',
    ])
    expect(result.buildId).toBe('mock-build-id')
    expect(result.tags).toContain('my-template:production')
    expect(result.tags).toContain('my-template:stable')
  })
})

describe('Template.deleteTag', () => {
  test('deletes a tag', async () => {
    // Should not throw
    await expect(
      Template.deleteTag('my-template:production')
    ).resolves.toBeUndefined()
  })

  test('handles 404 error for nonexistent tag', async () => {
    await expect(Template.deleteTag('nonexistent:tag')).rejects.toThrow()
  })
})
