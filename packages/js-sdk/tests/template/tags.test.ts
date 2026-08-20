import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'
import { apiUrl, buildTemplateTest, TEST_API_KEY } from '../setup'
import { createMockBuildApi } from './mockBuildApi'

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

// The placeholder key keeps the mocked template tests independent of
// E2B_API_KEY being set in the environment.
const apiKey = process.env.E2B_API_KEY ?? TEST_API_KEY

// Unit tests with mock server
describe('Template tags unit tests', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterAll(() => server.close())
  afterEach(() => server.resetHandlers())

  describe('Template.assignTags', () => {
    test('assigns a single tag', async () => {
      const result = await Template.assignTags(
        'my-template:v1.0',
        'production',
        { apiKey }
      )
      expect(result.buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(result.tags).toContain('production')
    })

    test('assigns multiple tags', async () => {
      const result = await Template.assignTags(
        'my-template:v1.0',
        ['production', 'stable'],
        { apiKey }
      )
      expect(result.buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(result.tags).toContain('production')
      expect(result.tags).toContain('stable')
    })
  })

  describe('Template.removeTags', () => {
    test('deletes a single tag', async () => {
      // Should not throw
      await expect(
        Template.removeTags('my-template', 'production', { apiKey })
      ).resolves.toBeUndefined()
    })

    test('deletes multiple tags', async () => {
      // Should not throw
      await expect(
        Template.removeTags('my-template', ['production', 'staging'], {
          apiKey,
        })
      ).resolves.toBeUndefined()
    })

    test('handles 404 error for nonexistent template', async () => {
      await expect(
        Template.removeTags('nonexistent', ['tag'], { apiKey })
      ).rejects.toThrow()
    })
  })

  describe('Template.getTags', () => {
    test('returns tags for a template', async () => {
      const tags = await Template.getTags('my-template-id', { apiKey })
      expect(tags).toHaveLength(2)
      expect(tags[0].tag).toBe('v1.0')
      expect(tags[0].buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(tags[0].createdAt).toBeInstanceOf(Date)
      expect(tags[1].tag).toBe('latest')
      expect(tags[1].buildId).toBe('11111111-1111-1111-1111-111111111111')
      expect(tags[1].createdAt).toBeInstanceOf(Date)
    })

    test('handles 404 for nonexistent template', async () => {
      await expect(
        Template.getTags('nonexistent', { apiKey })
      ).rejects.toThrow()
    })
  })
})

// Integration tests against the stateful mock build API
describe('Template tags integration tests', () => {
  const integrationServer = setupServer(...createMockBuildApi().handlers)

  beforeAll(() => integrationServer.listen({ onUnhandledRequest: 'error' }))
  afterAll(() => integrationServer.close())

  buildTemplateTest(
    'build template with tags, assign and delete',
    async ({ buildTemplate }) => {
      const templateName = 'e2b-tags-test'
      const initialTag = `${templateName}:v1-${randomUUID()}`

      // Build a template with initial tag
      const template = Template().fromBaseImage()
      const buildInfo = await buildTemplate(template, { name: initialTag })

      expect(buildInfo.buildId).toBeTruthy()
      expect(buildInfo.templateId).toBeTruthy()

      // Assign additional tags (just tag names, not full alias:tag format)
      const tagInfo = await Template.assignTags(
        initialTag,
        ['production', 'latest'],
        { apiKey }
      )

      expect(tagInfo.buildId).toBeTruthy()
      expect(tagInfo.tags).toContain('production')
      expect(tagInfo.tags).toContain('latest')
    }
  )

  buildTemplateTest(
    'assign single tag to existing template',
    async ({ buildTemplate }) => {
      const templateName = 'e2b-tags-test'
      const initialTag = `${templateName}:v1-${randomUUID()}`

      const template = Template().fromBaseImage()
      await buildTemplate(template, { name: initialTag })

      // Assign single tag (just tag name, not full alias:tag format)
      const tagInfo = await Template.assignTags(initialTag, 'stable', {
        apiKey,
      })

      expect(tagInfo.buildId).toBeTruthy()
      expect(tagInfo.tags).toContain('stable')
    }
  )

  buildTemplateTest(
    'rejects invalid tag format - missing alias',
    async ({ buildTemplate }) => {
      const templateName = 'e2b-tags-test'
      const initialTag = `${templateName}:v1-${randomUUID()}`

      const template = Template().fromBaseImage()
      await buildTemplate(template, { name: initialTag })

      // Tag without alias (starts with colon) should be rejected
      await expect(
        Template.assignTags(initialTag, ':invalid-tag', { apiKey })
      ).rejects.toThrow()
    }
  )

  buildTemplateTest(
    'rejects invalid tag format - missing tag',
    async ({ buildTemplate }) => {
      const templateName = 'e2b-tags-test'
      const initialTag = `${templateName}:v1-${randomUUID()}`

      const template = Template().fromBaseImage()
      await buildTemplate(template, { name: initialTag })

      // Tag without tag portion (ends with colon) should be rejected
      await expect(
        Template.assignTags(initialTag, `${templateName}:`, { apiKey })
      ).rejects.toThrow()
    }
  )
})
