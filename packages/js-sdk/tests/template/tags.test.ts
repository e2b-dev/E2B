import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'
import { apiUrl } from '../setup'

// Mock handlers for tag API endpoints
const mockHandlers = [
  http.post(apiUrl('/templates/tags'), async ({ request }) => {
    const { tags } = (await request.clone().json()) as {
      tags: string[]
    }
    return HttpResponse.json({
      buildID: '00000000-0000-0000-0000-000000000000',
      tags: tags,
    })
  }),
  // Get template tags endpoint
  http.get(apiUrl('/templates/:templateID/tags'), ({ params }) => {
    const { templateID } = params
    if (templateID === 'nonexistent') {
      return HttpResponse.json(
        { message: 'Template not found' },
        { status: 404 }
      )
    }
    return HttpResponse.json([
      {
        tag: 'v1.0',
        buildID: '00000000-0000-0000-0000-000000000000',
        createdAt: '2024-01-15T10:30:00Z',
      },
      {
        tag: 'latest',
        buildID: '11111111-1111-1111-1111-111111111111',
        createdAt: '2024-01-16T12:00:00Z',
      },
    ])
  }),
  // Bulk delete endpoint
  http.delete(apiUrl('/templates/tags'), async ({ request }) => {
    const { name } = (await request.clone().json()) as {
      name: string
      tags: string[]
    }
    if (name === 'nonexistent') {
      return HttpResponse.json(
        { message: 'Template not found' },
        { status: 404 }
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),
]

const server = setupServer(...mockHandlers)

// Unit tests with mock server
describe('Template tags unit tests', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterAll(() => server.close())
  afterEach(() => server.resetHandlers())

  describe('Template.assignTags', () => {
    test('assigns a single tag', async () => {
      const result = await Template.assignTags('my-template:v1.0', 'production')
      expect(result.buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(result.tags).toContain('production')
    })

    test('assigns multiple tags', async () => {
      const result = await Template.assignTags('my-template:v1.0', [
        'production',
        'stable',
      ])
      expect(result.buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(result.tags).toContain('production')
      expect(result.tags).toContain('stable')
    })
  })

  describe('Template.removeTags', () => {
    test('deletes a single tag', async () => {
      // Should not throw
      await expect(
        Template.removeTags('my-template', 'production')
      ).resolves.toBeUndefined()
    })

    test('deletes multiple tags', async () => {
      // Should not throw
      await expect(
        Template.removeTags('my-template', ['production', 'staging'])
      ).resolves.toBeUndefined()
    })

    test('handles 404 error for nonexistent template', async () => {
      await expect(
        Template.removeTags('nonexistent', ['tag'])
      ).rejects.toThrow()
    })
  })

  describe('Template.getTags', () => {
    test('returns tags for a template', async () => {
      const tags = await Template.getTags('my-template-id')
      expect(tags).toHaveLength(2)
      expect(tags[0].tag).toBe('v1.0')
      expect(tags[0].buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(tags[0].createdAt).toBeInstanceOf(Date)
      expect(tags[1].tag).toBe('latest')
      expect(tags[1].buildId).toBe('11111111-1111-1111-1111-111111111111')
      expect(tags[1].createdAt).toBeInstanceOf(Date)
    })

    test('handles 404 for nonexistent template', async () => {
      await expect(Template.getTags('nonexistent')).rejects.toThrow()
    })
  })
})
