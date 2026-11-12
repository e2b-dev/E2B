import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template, TemplateError } from '../../src'
import { apiUrl } from '../setup'

function mockTemplate(index: number) {
  return {
    templateID: `template-${index}`,
    buildID: `00000000-0000-0000-0000-00000000000${index}`,
    names: [`team/template-${index}`],
    aliases: [`template-${index}`],
    public: index === 0,
    isDefault: index === 0,
    buildStatus: 'ready',
    cpuCount: 2,
    memoryMB: 1024,
    diskSizeMB: 5120,
    envdVersion: '0.2.0',
    buildCount: index + 1,
    spawnCount: index * 10,
    createdBy: null,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-16T12:00:00Z',
    lastSpawnedAt: index === 0 ? null : '2024-01-17T08:00:00Z',
    ...(index === 1 && { description: 'Second template', maxCpuCount: 4 }),
  }
}

const templates = [0, 1, 2].map(mockTemplate)

const server = setupServer(
  http.get(apiUrl('/v2/templates'), ({ request }) => {
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') ?? 100)
    const start = Number(url.searchParams.get('nextToken') ?? 0)

    const headers: Record<string, string> = {}
    if (start + limit < templates.length) {
      headers['x-next-token'] = String(start + limit)
    }
    return HttpResponse.json(templates.slice(start, start + limit), {
      headers,
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

describe('Template.list', () => {
  test('pages through templates', async () => {
    const paginator = Template.list({ limit: 2 })

    const firstPage = await paginator.nextItems()
    expect(firstPage.map((t) => t.templateId)).toEqual([
      'template-0',
      'template-1',
    ])
    expect(paginator.hasNext).toBe(true)
    expect(paginator.nextToken).toBe('2')

    const secondPage = await paginator.nextItems()
    expect(secondPage.map((t) => t.templateId)).toEqual(['template-2'])
    expect(paginator.hasNext).toBe(false)

    await expect(paginator.nextItems()).rejects.toThrow('No more items')
  })

  test('starts from nextToken', async () => {
    const paginator = Template.list({ nextToken: '1' })

    const items = await paginator.nextItems()
    expect(items.map((t) => t.templateId)).toEqual(['template-1', 'template-2'])
    expect(paginator.hasNext).toBe(false)
  })

  test('maps template info', async () => {
    const [defaultTemplate, described] = await Template.list().nextItems()

    expect(defaultTemplate).toEqual({
      templateId: 'template-0',
      buildId: '00000000-0000-0000-0000-000000000000',
      names: ['team/template-0'],
      public: true,
      isDefault: true,
      buildStatus: 'ready',
      cpuCount: 2,
      memoryMB: 1024,
      diskSizeMB: 5120,
      envdVersion: '0.2.0',
      buildCount: 1,
      spawnCount: 0,
      createdAt: new Date('2024-01-15T10:30:00Z'),
      updatedAt: new Date('2024-01-16T12:00:00Z'),
    })
    expect(described.description).toBe('Second template')
    expect(described.maxCpuCount).toBe(4)
    expect(described.lastSpawnedAt).toEqual(new Date('2024-01-17T08:00:00Z'))
  })

  test('throws TemplateError on API errors', async () => {
    server.use(
      http.get(apiUrl('/v2/templates'), () =>
        HttpResponse.json(
          { code: 500, message: 'internal error' },
          { status: 500 }
        )
      )
    )

    await expect(Template.list().nextItems()).rejects.toThrow(TemplateError)
  })
})
