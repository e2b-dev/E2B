import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'
import { buildTemplateTest, isDebug } from '../setup'

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

// Unit tests with mock server
describe('Template tags unit tests', () => {
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
})

// Integration tests
buildTemplateTest.skipIf(isDebug)(
  'build template with tags, assign and delete',
  async ({ buildTemplate }) => {
    const templateAlias = `e2b-js-tags-test-${randomUUID()}`
    const initialTag = `${templateAlias}:v1.0`

    // Build a template with initial tag
    const template = Template().fromBaseImage()
    const buildInfo = await buildTemplate(template, { name: initialTag })

    expect(buildInfo.buildId).toBeTruthy()
    expect(buildInfo.templateId).toBeTruthy()

    // Assign additional tags
    const productionTag = `${templateAlias}:production`
    const latestTag = `${templateAlias}:latest`

    const tagInfo = await Template.assignTag(initialTag, [
      productionTag,
      latestTag,
    ])

    expect(tagInfo.buildId).toBeTruthy()
    // API returns just the tag portion, not the full alias:tag
    expect(tagInfo.tags).toContain('production')
    expect(tagInfo.tags).toContain('latest')

    // Delete tags
    await Template.deleteTag(productionTag)

    // Clean up
    await Template.deleteTag(initialTag)
    await Template.deleteTag(latestTag)
  },
  { timeout: 300_000 }
)

buildTemplateTest.skipIf(isDebug)(
  'assign single tag to existing template',
  async ({ buildTemplate }) => {
    const templateAlias = `e2b-js-single-tag-${randomUUID()}`
    const initialTag = `${templateAlias}:v1.0`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Assign single tag (not array)
    const stableTag = `${templateAlias}:stable`
    const tagInfo = await Template.assignTag(initialTag, stableTag)

    expect(tagInfo.buildId).toBeTruthy()
    // API returns just the tag portion, not the full alias:tag
    expect(tagInfo.tags).toContain('stable')

    // Clean up
    await Template.deleteTag(initialTag)
    await Template.deleteTag(stableTag)
  },
  { timeout: 300_000 }
)
