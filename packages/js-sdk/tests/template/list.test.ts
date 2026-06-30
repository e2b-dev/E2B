import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template } from '../../src'
import { TEST_API_KEY, apiUrl } from '../setup'

// A minimal /v2/templates payload item.
function template(templateID: string) {
  return {
    aliases: [templateID],
    buildCount: 1,
    buildID: `build-${templateID}`,
    buildStatus: 'ready',
    cpuCount: 2,
    createdAt: '2024-01-01T00:00:00Z',
    createdBy: null,
    diskSizeMB: 2048,
    envdVersion: '0.1.0',
    lastSpawnedAt: null,
    memoryMB: 1024,
    names: [`team/${templateID}`],
    public: false,
    spawnCount: 0,
    templateID,
    updatedAt: '2024-02-01T00:00:00Z',
  }
}

// Serve queued pages of templates, echoing each page's cursor via the
// `x-next-token` response header (the contract BasePaginator relies on).
let pages: { ids: string[]; nextToken?: string }[] = []
let calls: { nextToken: string | null; limit: string | null }[] = []

const server = setupServer(
  http.get(apiUrl('/v2/templates'), ({ request }) => {
    const url = new URL(request.url)
    calls.push({
      nextToken: url.searchParams.get('nextToken'),
      limit: url.searchParams.get('limit'),
    })

    const page = pages.shift() ?? { ids: [] }
    const headers: Record<string, string> = {}
    if (page.nextToken) {
      headers['x-next-token'] = page.nextToken
    }

    return HttpResponse.json(page.ids.map(template), { headers })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  pages = []
  calls = []
})

test('Template.list paginates across pages via x-next-token', async () => {
  pages = [
    { ids: ['t1', 't2'], nextToken: 'tok1' },
    { ids: ['t3'], nextToken: undefined },
  ]

  const paginator = Template.list({ apiKey: TEST_API_KEY })

  const collected: string[] = []
  while (paginator.hasNext) {
    const items = await paginator.nextItems()
    collected.push(...items.map((t) => t.templateId))
  }

  expect(collected).toEqual(['t1', 't2', 't3'])
  // First request has no cursor; the second forwards the previous page token.
  expect(calls[0].nextToken).toBeNull()
  expect(calls[1].nextToken).toBe('tok1')
  expect(paginator.hasNext).toBe(false)
})

test('Template.list maps API fields to TemplateInfo', async () => {
  pages = [{ ids: ['my-template'], nextToken: undefined }]

  const paginator = Template.list({ apiKey: TEST_API_KEY })
  const [info] = await paginator.nextItems()

  expect(info.templateId).toBe('my-template')
  expect(info.buildId).toBe('build-my-template')
  expect(info.names).toEqual(['team/my-template'])
  expect(info.createdAt).toBeInstanceOf(Date)
  expect(info.lastSpawnedAt).toBeNull()
  expect(info.cpuCount).toBe(2)
})

test('Template.list forwards the limit as the page size', async () => {
  pages = [{ ids: [], nextToken: undefined }]

  const paginator = Template.list({ apiKey: TEST_API_KEY, limit: 25 })
  await paginator.nextItems()

  expect(calls[0].limit).toBe('25')
})

test('Template.list returns an empty list once exhausted', async () => {
  pages = [{ ids: ['t1'], nextToken: undefined }]

  const paginator = Template.list({ apiKey: TEST_API_KEY })
  await paginator.nextItems()

  expect(paginator.hasNext).toBe(false)
  // An exhausted paginator returns [] rather than throwing.
  await expect(paginator.nextItems()).resolves.toEqual([])
})
