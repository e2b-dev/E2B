import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { bindClientOpts, BuildOptions, Template, TemplateBase } from '../../src'
import { apiUrl, TEST_API_KEY } from '../setup'

const BOUND_API_KEY = `e2b_${'1'.repeat(40)}`
const BOUND_DOMAIN = 'bound.example.com'

/** Stands in for the per-client `client.Template` — same statics, bound config. */
class BoundTemplate extends TemplateBase {
  protected static readonly boundOpts = {
    apiKey: BOUND_API_KEY,
    domain: BOUND_DOMAIN,
  }
}

const requests: { url: string; apiKey: string | null }[] = []

function recordRequest(request: Request) {
  requests.push({
    url: request.url,
    apiKey: request.headers.get('X-API-KEY'),
  })
}

function boundApiUrl(path: string): string {
  return `https://api.${BOUND_DOMAIN}${path}`
}

const templateTags = [
  {
    tag: 'v1.0',
    buildID: '00000000-0000-0000-0000-000000000000',
    createdAt: '2024-01-15T10:30:00Z',
  },
]

const handlers = [apiUrl, boundApiUrl].flatMap((url) => [
  http.get(url('/templates/:templateID/tags'), ({ request }) => {
    recordRequest(request)
    return HttpResponse.json(templateTags)
  }),
  http.get(url('/templates/aliases/:alias'), ({ request }) => {
    recordRequest(request)
    return HttpResponse.json({ aliases: [], templateID: 'template-id' })
  }),
  http.post(url('/templates/tags'), async ({ request }) => {
    recordRequest(request)
    return HttpResponse.json({
      buildID: '00000000-0000-0000-0000-000000000000',
      tags: ['production'],
    })
  }),
  http.delete(url('/templates/tags'), async ({ request }) => {
    recordRequest(request)
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(url('/v3/templates'), async ({ request }) => {
    recordRequest(request)
    return HttpResponse.json({
      templateID: 'template-id',
      buildID: '00000000-0000-0000-0000-000000000000',
      tags: [],
    })
  }),
  http.post(
    url('/v2/templates/:templateID/builds/:buildID'),
    async ({ request }) => {
      recordRequest(request)
      return HttpResponse.json({}, { status: 202 })
    }
  ),
])

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  requests.length = 0
  server.resetHandlers()
})

test('top-level statics resolve config from per-call options', async () => {
  await Template.getTags('my-template-id', { apiKey: TEST_API_KEY })
  await Template.exists('my-template', { apiKey: TEST_API_KEY })
  await Template.assignTags('my-template:v1.0', 'production', {
    apiKey: TEST_API_KEY,
  })
  await Template.removeTags('my-template', 'production', {
    apiKey: TEST_API_KEY,
  })
  await Template.buildInBackground(Template().fromBaseImage(), 'my-template', {
    apiKey: TEST_API_KEY,
  })

  expect(requests.length).toBe(6)
  for (const request of requests) {
    expect(request.apiKey).toBe(TEST_API_KEY)
    expect(request.url).toContain(`api.${process.env.E2B_DOMAIN || 'e2b.app'}`)
  }
})

test('subclass bound options are used as defaults', async () => {
  await BoundTemplate.getTags('my-template-id')
  await BoundTemplate.exists('my-template')
  await BoundTemplate.aliasExists('my-template')
  await BoundTemplate.assignTags('my-template:v1.0', 'production')
  await BoundTemplate.removeTags('my-template', 'production')
  await BoundTemplate.buildInBackground(
    Template().fromBaseImage(),
    'my-template'
  )

  expect(requests.length).toBe(7)
  for (const request of requests) {
    expect(request.apiKey).toBe(BOUND_API_KEY)
    expect(request.url).toContain(`api.${BOUND_DOMAIN}`)
  }
})

test('per-call options override bound options', async () => {
  await BoundTemplate.getTags('my-template-id', { apiKey: TEST_API_KEY })

  expect(requests).toEqual([
    {
      url: boundApiUrl('/templates/my-template-id/tags'),
      apiKey: TEST_API_KEY,
    },
  ])
})

test('undefined per-call options do not clear bound options', async () => {
  await BoundTemplate.getTags('my-template-id', { apiKey: undefined })

  expect(requests[0].apiKey).toBe(BOUND_API_KEY)
})

test('build options carry the bound options into the build', async () => {
  class ProbeTemplate extends TemplateBase {
    protected static readonly boundOpts = {
      apiKey: BOUND_API_KEY,
      requestTimeoutMs: 1234,
    }

    static probeBuildOpts(options?: BuildOptions) {
      return this.resolveOpts(options)
    }
  }

  // The whole merged object is handed to the build, so file uploads and the
  // build-log polling see the bound request timeout too.
  expect(ProbeTemplate.probeBuildOpts({ tags: ['v1.0'] })).toEqual({
    apiKey: BOUND_API_KEY,
    requestTimeoutMs: 1234,
    tags: ['v1.0'],
  })
  expect(ProbeTemplate.probeBuildOpts({ requestTimeoutMs: 42 })).toEqual({
    apiKey: BOUND_API_KEY,
    requestTimeoutMs: 42,
  })
})

test('bindClientOpts merges with already-bound options', () => {
  class ProbeTemplate extends TemplateBase {
    static probeBuildOpts(options?: BuildOptions) {
      return this.resolveOpts(options)
    }
  }

  const bound = bindClientOpts(ProbeTemplate, {
    apiKey: BOUND_API_KEY,
    requestTimeoutMs: 1234,
  })
  const rebound = bindClientOpts(bound, { requestTimeoutMs: 42 })

  expect(rebound.probeBuildOpts()).toEqual({
    apiKey: BOUND_API_KEY,
    requestTimeoutMs: 42,
  })
  // The original class keeps its own bound options.
  expect(bound.probeBuildOpts()).toEqual({
    apiKey: BOUND_API_KEY,
    requestTimeoutMs: 1234,
  })
})
