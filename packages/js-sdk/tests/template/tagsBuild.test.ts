import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'

import { Template } from '../../src'
import { e2eBuildTemplateTest } from '../setup'

e2eBuildTemplateTest(
  'build template with tags, assign and delete',
  { timeout: 300_000 },
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
  }
)

e2eBuildTemplateTest(
  'assign single tag to existing template',
  { timeout: 300_000 },
  async ({ buildTemplate }) => {
    const templateName = 'e2b-tags-test'
    const initialTag = `${templateName}:v1-${randomUUID()}`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Assign single tag (just tag name, not full alias:tag format)
    const tagInfo = await Template.assignTags(initialTag, 'stable')

    expect(tagInfo.buildId).toBeTruthy()
    expect(tagInfo.tags).toContain('stable')
  }
)

e2eBuildTemplateTest(
  'rejects invalid tag format - missing alias',
  { timeout: 300_000 },
  async ({ buildTemplate }) => {
    const templateName = 'e2b-tags-test'
    const initialTag = `${templateName}:v1-${randomUUID()}`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Tag without alias (starts with colon) should be rejected
    await expect(
      Template.assignTags(initialTag, ':invalid-tag')
    ).rejects.toThrow()
  }
)

e2eBuildTemplateTest(
  'rejects invalid tag format - missing tag',
  { timeout: 300_000 },
  async ({ buildTemplate }) => {
    const templateName = 'e2b-tags-test'
    const initialTag = `${templateName}:v1-${randomUUID()}`

    const template = Template().fromBaseImage()
    await buildTemplate(template, { name: initialTag })

    // Tag without tag portion (ends with colon) should be rejected
    await expect(
      Template.assignTags(initialTag, `${templateName}:`)
    ).rejects.toThrow()
  }
)
