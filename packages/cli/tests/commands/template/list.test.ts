import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const list = vi.fn()
  return { list }
})

vi.mock('e2b', async (importOriginal: () => Promise<typeof import('e2b')>) => {
  const actual = await importOriginal()
  return {
    ...actual,
    Template: { ...actual.Template, list: mocks.list },
  }
})

vi.mock('src/api', () => ({
  ensureAPIKey: vi.fn(() => 'test-api-key'),
  resolveTeamId: vi.fn((team?: string) => team),
}))

import { listSandboxTemplates } from '../../../src/commands/template/list'

// Minimal TemplateInfo as returned by the SDK paginator.
function templateInfo(templateId: string) {
  return {
    templateId,
    buildId: `build-${templateId}`,
    cpuCount: 2,
    memoryMB: 1024,
    diskSizeMB: 2048,
    public: false,
    aliases: [],
    names: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastSpawnedAt: null,
    spawnCount: 0,
    buildCount: 1,
    envdVersion: '0.1.0',
    createdBy: null,
    buildStatus: 'ready',
  }
}

type Page = { ids: string[]; last: boolean }

// Build a fake paginator that mirrors the SDK BasePaginator contract:
// `hasNext` starts true and flips to false once a page reports it is the last.
function makePaginator(pages: Page[]) {
  let i = 0
  let hasNext = true
  const nextItems = vi.fn(async () => {
    const page = pages[i++]
    hasNext = !page.last
    return page.ids.map(templateInfo)
  })
  return {
    get hasNext() {
      return hasNext
    },
    nextItems,
  }
}

describe('listSandboxTemplates pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns a single page when there is no next page', async () => {
    const paginator = makePaginator([{ ids: ['t1', 't2'], last: true }])
    mocks.list.mockReturnValue(paginator)

    const { templates, hasMore } = await listSandboxTemplates({})

    expect(templates.map((t) => t.templateID)).toEqual(['t1', 't2'])
    expect(hasMore).toBe(false)
    expect(paginator.nextItems).toHaveBeenCalledTimes(1)
    // Uses the SDK paginator with the default page size and resolved API key.
    expect(mocks.list).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      teamId: undefined,
      limit: 100,
    })
  })

  test('accumulates across pages until the paginator is exhausted', async () => {
    const paginator = makePaginator([
      { ids: ['t1', 't2'], last: false },
      { ids: ['t3', 't4'], last: false },
      { ids: ['t5'], last: true },
    ])
    mocks.list.mockReturnValue(paginator)

    const { templates, hasMore } = await listSandboxTemplates({})

    expect(templates.map((t) => t.templateID)).toEqual([
      't1',
      't2',
      't3',
      't4',
      't5',
    ])
    expect(hasMore).toBe(false)
    expect(paginator.nextItems).toHaveBeenCalledTimes(3)
  })

  test('caps results at the requested limit and reports hasMore', async () => {
    const paginator = makePaginator([
      { ids: ['t1', 't2', 't3'], last: false },
      { ids: ['t4', 't5', 't6'], last: false },
    ])
    mocks.list.mockReturnValue(paginator)

    const { templates, hasMore } = await listSandboxTemplates({ limit: 4 })

    expect(templates.map((t) => t.templateID)).toEqual(['t1', 't2', 't3', 't4'])
    expect(hasMore).toBe(true)
    // Stops fetching once the collected count reaches the limit.
    expect(paginator.nextItems).toHaveBeenCalledTimes(2)
  })

  test('caps the per-page limit at the page size', async () => {
    mocks.list.mockReturnValue(makePaginator([{ ids: ['t1'], last: true }]))

    await listSandboxTemplates({ limit: 5000 })

    expect(mocks.list).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      teamId: undefined,
      limit: 100,
    })
  })

  test('uses the requested limit as the page size when below the page cap', async () => {
    mocks.list.mockReturnValue(
      makePaginator([
        { ids: ['t1', 't2'], last: false },
        { ids: ['t3'], last: true },
      ])
    )

    await listSandboxTemplates({ limit: 3 })

    expect(mocks.list).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      teamId: undefined,
      limit: 3,
    })
  })

  test('hasMore is false when the last page exactly fills without more pages', async () => {
    mocks.list.mockReturnValue(
      makePaginator([{ ids: ['t1', 't2'], last: true }])
    )

    const { templates, hasMore } = await listSandboxTemplates({ limit: 1000 })

    expect(templates.map((t) => t.templateID)).toEqual(['t1', 't2'])
    expect(hasMore).toBe(false)
  })

  test('forwards the team id to the paginator', async () => {
    mocks.list.mockReturnValue(makePaginator([{ ids: [], last: true }]))

    await listSandboxTemplates({ teamID: 'team-123' })

    expect(mocks.list).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      teamId: 'team-123',
      limit: 100,
    })
  })

  test('returns an empty list when there are no templates', async () => {
    mocks.list.mockReturnValue(makePaginator([{ ids: [], last: true }]))

    const { templates, hasMore } = await listSandboxTemplates({})

    expect(templates).toEqual([])
    expect(hasMore).toBe(false)
  })
})
