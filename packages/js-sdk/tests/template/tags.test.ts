import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'
import { apiUrl, buildTemplateTest, isDebug } from '../setup'

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
})

// Integration tests
buildTemplateTest.skipIf(isDebug)(
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
    const tagInfo = await Template.assignTags(initialTag, [
      'production',
      'latest',
    ])

    expect(tagInfo.buildId).toBeTruthy()
    expect(tagInfo.tags).toContain('production')
    expect(tagInfo.tags).toContain('latest')
  },
  { timeout: 300_000 }
)

buildTemplateTest.skipIf(isDebug)(
  'assign single tag to existing template',
  async ({ buildTemplate }) => {
    const templateName = 'e2b-tags-test'
    const initialTag = `${templateName}:v1-${randomUUID()}`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Assign single tag (just tag name, not full alias:tag format)
    const tagInfo = await Template.assignTags(initialTag, 'stable')

    expect(tagInfo.buildId).toBeTruthy()
    expect(tagInfo.tags).toContain('stable')
  },
  { timeout: 300_000 }
)

buildTemplateTest.skipIf(isDebug)(
  'rejects invalid tag format - missing alias',
  async ({ buildTemplate }) => {
    const templateName = 'e2b-tags-test'
    const initialTag = `${templateName}:v1-${randomUUID()}`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Tag without alias (starts with colon) should be rejected
    await expect(
      Template.assignTags(initialTag, ':invalid-tag')
    ).rejects.toThrow()
  },
  { timeout: 300_000 }
)

buildTemplateTest.skipIf(isDebug)(
  'rejects invalid tag format - missing tag',
  async ({ buildTemplate }) => {
    const templateName = 'e2b-tags-test'
    const initialTag = `${templateName}:v1-${randomUUID()}`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Tag without tag portion (ends with colon) should be rejected
    await expect(
      Template.assignTags(initialTag, `${templateName}:`)
    ).rejects.toThrow()
  },
  { timeout: 300_000 }
)
