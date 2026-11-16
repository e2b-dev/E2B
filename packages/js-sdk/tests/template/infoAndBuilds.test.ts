import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import {
  ConnectionOpts,
  InvalidArgumentError,
  Template,
  TemplateBuildListOpts,
  TemplateError,
  TemplateNotFoundError,
} from '../../src'
import { apiUrl, TEST_API_KEY } from '../setup'

const OTHER_API_KEY = `e2b_${'1'.repeat(40)}`

const template = {
  templateID: 'abc',
  names: ['acme/web'],
  public: false,
  isDefault: false,
  buildStatus: 'building',
  buildCount: 3,
  spawnCount: 12,
  createdBy: null,
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-16T12:00:00Z',
  lastSpawnedAt: null,
}

const readyBuildResponse = {
  buildID: '00000000-0000-0000-0000-0000000000b2',
  status: 'ready',
  cpuCount: 2,
  maxCpuCount: 4,
  memoryMB: 1024,
  diskSizeMB: 5120,
  envdVersion: '0.2.0',
  createdAt: '2024-01-16T10:30:00Z',
  updatedAt: '2024-01-16T10:35:00Z',
  finishedAt: '2024-01-16T10:34:00Z',
}

// Newest first, as the API returns them.
const builds = [
  {
    buildID: '00000000-0000-0000-0000-0000000000b3',
    status: 'error',
    cpuCount: 2,
    memoryMB: 1024,
    createdAt: '2024-01-17T10:30:00Z',
    updatedAt: '2024-01-17T10:31:00Z',
    tags: [],
  },
  { ...readyBuildResponse, tags: ['stable', 'v2'] },
  {
    buildID: '00000000-0000-0000-0000-0000000000b1',
    status: 'ready',
    cpuCount: 2,
    memoryMB: 1024,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:35:00Z',
    tags: ['default'],
  },
]

const readyBuild = {
  buildId: '00000000-0000-0000-0000-0000000000b2',
  status: 'ready',
  cpuCount: 2,
  maxCpuCount: 4,
  memoryMB: 1024,
  diskSizeMB: 5120,
  envdVersion: '0.2.0',
  createdAt: new Date('2024-01-16T10:30:00Z'),
  updatedAt: new Date('2024-01-16T10:35:00Z'),
  finishedAt: new Date('2024-01-16T10:34:00Z'),
}

const templateDetails = {
  templateId: 'abc',
  names: ['acme/web'],
  public: false,
  isDefault: false,
  buildStatus: 'building',
  buildCount: 3,
  spawnCount: 12,
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-01-16T12:00:00Z'),
}

// Template references the stand-in API answers with an error.
function errorResponse(nameOrId: unknown) {
  switch (nameOrId) {
    case 'missing':
      return HttpResponse.json(
        { code: 404, message: 'Template not found' },
        { status: 404 }
      )
    case 'no-such-route':
      return new HttpResponse('404 page not found', { status: 404 })
    case 'api-without-the-route':
      return HttpResponse.json(
        {
          code: 404,
          message: 'validation error: no matching operation was found',
        },
        { status: 404 }
      )
    case 'broken':
      return HttpResponse.json(
        { code: 500, message: 'Internal error' },
        { status: 500 }
      )
  }
}

const requests: { url: URL; apiKey: string | null }[] = []

const server = setupServer(
  http.get(apiUrl('/v2/templates/:templateID'), ({ request, params }) => {
    requests.push({
      url: new URL(request.url),
      apiKey: request.headers.get('X-API-KEY'),
    })

    switch (params.templateID) {
      case 'no-body':
        return new HttpResponse(null, { status: 200 })
      case 'first-build':
        return HttpResponse.json({ ...template, description: '' })
    }
    return (
      errorResponse(params.templateID) ??
      HttpResponse.json({
        ...template,
        description: 'Web server',
        lastSpawnedAt: '2024-01-17T08:00:00Z',
        defaultBuild: readyBuildResponse,
      })
    )
  }),
  http.get(apiUrl('/templates/:templateID/builds'), ({ request, params }) => {
    const url = new URL(request.url)
    requests.push({ url, apiKey: request.headers.get('X-API-KEY') })

    const limit = Number(url.searchParams.get('limit') ?? 100)
    const start = Number(url.searchParams.get('nextToken') ?? 0)
    const more = start + limit < builds.length
    return (
      errorResponse(params.templateID) ??
      HttpResponse.json(builds.slice(start, start + limit), {
        headers: more ? { 'x-next-token': String(start + limit) } : {},
      })
    )
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  requests.length = 0
  server.resetHandlers()
  vi.unstubAllEnvs()
})

const opts = { apiKey: TEST_API_KEY }
const sentFilters = () =>
  requests.map(({ url }) => [
    url.searchParams.get('statuses'),
    url.searchParams.get('tags'),
  ])

describe('Template.getInfo', () => {
  test('returns the template with its default build', async () => {
    expect(await Template.getInfo('abc', opts)).toEqual({
      ...templateDetails,
      description: 'Web server',
      lastSpawnedAt: new Date('2024-01-17T08:00:00Z'),
      defaultBuild: readyBuild,
    })
  })

  test('has no default build before the first build is ready', async () => {
    // The stand-in API also sends an empty description, which reads as none.
    expect(await Template.getInfo('first-build', opts)).toEqual(templateDetails)
  })

  test('fails when the API answers without a template', async () => {
    await expect(Template.getInfo('no-body', opts)).rejects.toThrow(
      new TemplateError('Failed to get template info')
    )
  })
})

describe('Template.listBuilds', () => {
  test('pages through the builds', async () => {
    const paginator = Template.listBuilds('abc', { ...opts, limit: 2 })

    const first = await paginator.nextItems()
    expect(first.map((b) => b.buildId.slice(-2))).toEqual(['b3', 'b2'])
    expect([paginator.hasNext, paginator.nextToken]).toEqual([true, '2'])

    const second = await paginator.nextItems()
    expect(second.map((b) => b.buildId.slice(-2))).toEqual(['b1'])
    expect(paginator.hasNext).toBe(false)

    await expect(paginator.nextItems()).rejects.toThrow('No more items')
  })

  test('starts from nextToken', async () => {
    const page = await Template.listBuilds('abc', {
      ...opts,
      nextToken: '2',
    }).nextItems()

    expect(page.map((b) => b.buildId.slice(-2))).toEqual(['b1'])
  })

  test('maps the builds', async () => {
    const [failed, resizable] = await Template.listBuilds(
      'abc',
      opts
    ).nextItems()

    expect(failed).toEqual({
      buildId: '00000000-0000-0000-0000-0000000000b3',
      status: 'error',
      cpuCount: 2,
      memoryMB: 1024,
      createdAt: new Date('2024-01-17T10:30:00Z'),
      updatedAt: new Date('2024-01-17T10:31:00Z'),
      tags: [],
    })
    expect(resizable).toEqual({ ...readyBuild, tags: ['stable', 'v2'] })
  })

  test.each<[TemplateBuildListOpts, (string | null)[]]>([
    [
      { statuses: ['ready', 'error'], tags: ['default', 'v2'] },
      ['ready,error', 'default,v2'],
    ],
    // one value without a list
    [{ statuses: 'ready', tags: 'v2' }, ['ready', 'v2']],
    // a status given twice is sent once
    [{ statuses: ['ready', 'error', 'ready'] }, ['ready,error', null]],
    // an empty filter is not sent
    [{ statuses: [], tags: [] }, [null, null]],
  ])('sends the filters %j as %j', async (filters, sent) => {
    await Template.listBuilds('abc', { ...opts, ...filters }).nextItems()

    expect(sentFilters()).toEqual([sent])
  })

  test('sends the same filters for every page, whatever the caller does to the lists', async () => {
    const statuses: ('ready' | 'error')[] = ['ready']
    const tags = ['default']
    const paginator = Template.listBuilds('abc', {
      ...opts,
      statuses,
      tags,
      limit: 2,
    })
    statuses.push('error')
    tags.push('v2')

    await paginator.nextItems()
    await paginator.nextItems()

    expect(sentFilters()).toEqual([
      ['ready', 'default'],
      ['ready', 'default'],
    ])
  })

  test.each([
    [
      { statuses: ['done'] },
      "Unknown build status 'done', expected one of: building, waiting, ready, error.",
    ],
    [
      { tags: ['v2', ''] },
      "Invalid tag '': a tag must not be empty or contain a comma.",
    ],
    [
      { tags: ['v2', ' '] },
      "Invalid tag ' ': a tag must not be empty or contain a comma.",
    ],
    [
      { tags: ['v1,v2'] },
      "Invalid tag 'v1,v2': a tag must not be empty or contain a comma.",
    ],
  ])('rejects the filter %j', (filters, message) => {
    // `as never`: a status the type does not allow
    expect(() => Template.listBuilds('abc', filters as never)).toThrow(
      new InvalidArgumentError(message)
    )
  })

  test('rejects the bare name of the alias route, which getInfo accepts', async () => {
    expect(() => Template.listBuilds('aliases', opts)).toThrow(
      new InvalidArgumentError(
        "A template named 'aliases' must be given by its ID or by its name with the team prefix, such as 'my-team/aliases'."
      )
    )

    await Template.listBuilds('acme/aliases', opts).nextItems()
    await Template.getInfo('aliases', opts)
    expect(requests.map(({ url }) => url.pathname)).toEqual([
      '/templates/acme%2Faliases/builds',
      '/v2/templates/aliases',
    ])
  })

  test('a failed page can be fetched again', async () => {
    const paginator = Template.listBuilds('broken', opts)

    await expect(paginator.nextItems()).rejects.toThrow(TemplateError)
    expect(paginator.hasNext).toBe(true)
  })

  test('per-call options override the options the paginator was created with', async () => {
    await Template.listBuilds('abc', opts).nextItems({ apiKey: OTHER_API_KEY })

    expect(requests.map(({ apiKey }) => apiKey)).toEqual([OTHER_API_KEY])
  })
})

// What both methods have in common is tested through each of them.
describe.each([
  [
    'getInfo',
    async (nameOrId: string, opts?: ConnectionOpts) =>
      Template.getInfo(nameOrId, opts),
  ],
  [
    'listBuilds',
    async (nameOrId: string, opts?: ConnectionOpts) =>
      Template.listBuilds(nameOrId, opts).nextItems(),
  ],
])('Template.%s', (_, call) => {
  test('encodes a namespaced name in the path', async () => {
    await call('acme/web', opts)

    expect(requests[0].url.pathname).toContain('/acme%2Fweb')
  })

  test('throws a TemplateNotFoundError when the template is not found', async () => {
    const error = await call('missing', opts).catch((err) => err)

    expect(error).toBeInstanceOf(TemplateNotFoundError)
    expect(error).toBeInstanceOf(TemplateError)
    expect(error.message).toBe("Template 'missing' not found")
    expect(error.statusCode).toBe(404)
  })

  test.each([
    // 404s that are not the API's "not found" answer, and another failure
    ['no-such-route', '404: 404 page not found'],
    [
      'api-without-the-route',
      '404: validation error: no matching operation was found',
    ],
    ['broken', '500: Internal error'],
  ])('throws a TemplateError for %s', async (nameOrId, message) => {
    const error = await call(nameOrId, opts).catch((err) => err)

    expect(error).toBeInstanceOf(TemplateError)
    expect(error).not.toBeInstanceOf(TemplateNotFoundError)
    expect(error.message).toBe(message)
  })

  test.each([
    [
      'acme/web:v2',
      "Expected a template name or ID without a tag, got 'acme/web:v2'. To read the build a tag points at, pass the tag to Template.listBuilds(nameOrId, { tags: [tag] }).",
    ],
    ['', "Invalid template name or ID ''."],
    ['.', "Invalid template name or ID '.'."],
    ['..', "Invalid template name or ID '..'."],
  ])('rejects the name %j', async (nameOrId, message) => {
    const error = await call(nameOrId, opts).catch((err) => err)

    expect(error).toBeInstanceOf(InvalidArgumentError)
    expect(error.message).toBe(message)
    expect(requests).toEqual([])
  })

  test('rejects a name before any API key is needed', async () => {
    vi.stubEnv('E2B_API_KEY', '')

    await expect(call('acme/web:v2')).rejects.toBeInstanceOf(
      InvalidArgumentError
    )
  })
})
