import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'
import { apiUrl, buildTemplateTest, isDebug } from '../setup'

// Mock handlers for tag API endpoints
const mockHandlers = [
  http.post(apiUrl('/templates/tags'), async ({ request }) => {
    const { names } = (await request.clone().json()) as {
      names: string[]
    }
    return HttpResponse.json({
      buildID: '00000000-0000-0000-0000-000000000000',
      names: names,
    })
  }),
  http.delete<{ name: string }>(
    apiUrl('/templates/tags/:name'),
    ({ params }) => {
      const name = decodeURIComponent(params.name)
      if (name === 'nonexistent:tag') {
        return HttpResponse.json({ message: 'Tag not found' }, { status: 404 })
      }
      return new HttpResponse(null, { status: 204 })
    }
  ),
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
      expect(result.buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(result.names).toContain('my-template:production')
    })

    test('assigns multiple tags', async () => {
      const result = await Template.assignTag('my-template:v1.0', [
        'my-template:production',
        'my-template:stable',
      ])
      expect(result.buildId).toBe('00000000-0000-0000-0000-000000000000')
      expect(result.names).toContain('my-template:production')
      expect(result.names).toContain('my-template:stable')
    })
  })

  describe('Template.removeTag', () => {
    test('deletes a tag', async () => {
      // Should not throw
      await expect(
        Template.removeTag('my-template:production')
      ).resolves.toBeUndefined()
    })

    test('handles 404 error for nonexistent tag', async () => {
      await expect(Template.removeTag('nonexistent:tag')).rejects.toThrow()
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
    expect(tagInfo.names).toContain('production')
    expect(tagInfo.names).toContain('latest')

    // Delete tags
    await Template.removeTag(productionTag)
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
    expect(tagInfo.names).toContain('stable')
  },
  { timeout: 300_000 }
)

buildTemplateTest.skipIf(isDebug)(
  'rejects invalid tag format - missing alias',
  async ({ buildTemplate }) => {
    const templateAlias = `e2b-js-invalid-tag-${randomUUID()}`
    const initialTag = `${templateAlias}:v1.0`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Tag without alias (starts with colon) should be rejected
    await expect(
      Template.assignTag(initialTag, ':invalid-tag')
    ).rejects.toThrow()
  },
  { timeout: 300_000 }
)

buildTemplateTest.skipIf(isDebug)(
  'rejects invalid tag format - missing tag',
  async ({ buildTemplate }) => {
    const templateAlias = `e2b-js-invalid-tag2-${randomUUID()}`
    const initialTag = `${templateAlias}:v1.0`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Tag without tag portion (ends with colon) should be rejected
    await expect(
      Template.assignTag(initialTag, `${templateAlias}:`)
    ).rejects.toThrow()
  },
  { timeout: 300_000 }
)
