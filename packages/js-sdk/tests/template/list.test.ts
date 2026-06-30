import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'

import { Sandbox, Template, TemplateInfo } from '../../src'
import { buildTemplateTest, isDebug } from '../setup'

buildTemplateTest.skipIf(isDebug)(
  'lists a freshly built template via Template.list',
  { timeout: 300_000 },
  async ({ buildTemplate }) => {
    const name = `e2b-list-test:v1-${randomUUID()}`
    const buildInfo = await buildTemplate(Template().fromBaseImage(), { name })

    expect(buildInfo.templateId).toBeTruthy()

    try {
      // Paginate through the real /v2/templates endpoint.
      const paginator = Template.list()
      const templates: TemplateInfo[] = []
      while (paginator.hasNext) {
        templates.push(...(await paginator.nextItems()))
      }

      const found = templates.find((t) => t.templateId === buildInfo.templateId)
      expect(found).toBeDefined()
      expect(found!.buildId).toBe(buildInfo.buildId)
      expect(found!.createdAt).toBeInstanceOf(Date)
      expect(Array.isArray(found!.names)).toBe(true)
      expect(typeof found!.public).toBe('boolean')
      expect(typeof found!.cpuCount).toBe('number')

      // Exhausted paginator returns an empty list rather than throwing.
      expect(paginator.hasNext).toBe(false)
      await expect(paginator.nextItems()).resolves.toEqual([])
    } finally {
      await Sandbox.deleteSnapshot(buildInfo.templateId)
    }
  }
)
